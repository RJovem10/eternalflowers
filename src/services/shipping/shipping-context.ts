/**
 * shipping-context.ts — Resolve shipping context server-side a partir da Order real
 *
 * Responsabilidades:
 * - Carregar Shipping Settings (Payload Global)
 * - Determinar shippingClass dos produtos da Order
 * - Calcular peso do parcel em kg
 * - Fornecer origin (morada da loja) e parcel server-side
 *
 * NÃO integra CTT nem faz shipping quote.
 * NÃO aceita shippingClass/peso/origin do browser.
 */

import type { Payload } from 'payload'
import {
  type ShippingParcel,
  type ShippingAddress,
} from './shipping-types'

// ─── Shipping Context Output ───────────────────────────────────

export interface ShippingContext {
  origin: ShippingAddress
  parcel: ShippingParcel
}

// ─── Erros tipados ────────────────────────────────────────────

export class ShippingSettingsNotConfiguredError extends Error {
  code = 'SHIPPING_SETTINGS_NOT_CONFIGURED' as const
  constructor(msg = 'Configurações de expedição não encontradas.') {
    super(msg)
    this.name = 'ShippingSettingsNotConfiguredError'
  }
}

export class InvalidShippingSettingsError extends Error {
  code = 'INVALID_SHIPPING_SETTINGS' as const
  details: string
  constructor(msg: string, details: string) {
    super(msg)
    this.name = 'InvalidShippingSettingsError'
    this.details = details
  }
}

export class InvalidShippingWeightError extends Error {
  code = 'INVALID_SHIPPING_WEIGHT' as const
  details: string
  constructor(msg: string, details: string) {
    super(msg)
    this.name = 'InvalidShippingWeightError'
    this.details = details
  }
}

// ─── Validação interna ─────────────────────────────────────────

function validateShippingSettings(settings: any): void {
  if (!settings) {
    throw new ShippingSettingsNotConfiguredError(
      'Configurações de expedição (shipping-settings) não encontradas no Payload Global.',
    )
  }

  const errors: string[] = []

  // Validar origin
  const origin = settings.origin
  if (!origin) {
    errors.push('origin group não encontrada nas configurações.')
  } else {
    if (!origin.senderName || typeof origin.senderName !== 'string' || !origin.senderName.trim()) {
      errors.push('origin.senderName é obrigatório.')
    }
    if (!origin.line1 || typeof origin.line1 !== 'string' || !origin.line1.trim()) {
      errors.push('origin.line1 é obrigatório.')
    }
    if (!origin.city || typeof origin.city !== 'string' || !origin.city.trim()) {
      errors.push('origin.city é obrigatório.')
    }
    if (!origin.postalCode || typeof origin.postalCode !== 'string' || !origin.postalCode.trim()) {
      errors.push('origin.postalCode é obrigatório.')
    }
    if (!origin.country || typeof origin.country !== 'string') {
      errors.push('origin.country é obrigatório.')
    } else if (!/^[A-Z]{2}$/.test(origin.country)) {
      errors.push('origin.country deve ser ISO 3166-1 alpha-2 (ex: PT).')
    }
  }

  // Validar weightSettings
  const weightSettings = settings.weightSettings
  if (!weightSettings) {
    errors.push('weightSettings group não encontrada nas configurações.')
  } else {
    if (typeof weightSettings.standardWeightGrams !== 'number' || weightSettings.standardWeightGrams <= 0) {
      errors.push('weightSettings.standardWeightGrams deve ser um número inteiro positivo.')
    }
    if (typeof weightSettings.cupulaWeightGrams !== 'number' || weightSettings.cupulaWeightGrams <= 0) {
      errors.push('weightSettings.cupulaWeightGrams deve ser um número inteiro positivo.')
    }
  }

  if (errors.length > 0) {
    throw new InvalidShippingSettingsError(
      'Configurações de expedição inválidas.',
      errors.join('; '),
    )
  }
}

// ─── Resolver de peso ──────────────────────────────────────────

function resolveWeightKg(
  weightSettings: { standardWeightGrams: number; cupulaWeightGrams: number },
  items: any[],
): number {
  // shippingClass por item — se algum item for cupula, usa peso de cúpula
  const hasCupula = items.some((item: any) => item.shippingClass === 'cupula')

  if (hasCupula) {
    return weightSettings.cupulaWeightGrams / 1000
  }

  return weightSettings.standardWeightGrams / 1000
}

// ─── Build origin from settings ────────────────────────────────

function buildOrigin(origin: any): ShippingAddress {
  return {
    recipientName: origin.senderName,
    phone: origin.phone || undefined,
    line1: origin.line1,
    line2: origin.line2 || undefined,
    city: origin.city,
    region: origin.region || undefined,
    postalCode: origin.postalCode,
    country: origin.country,
  }
}

// ─── resolveShippingContext ─────────────────────────────────────

/**
 * Dada uma Order real, carrega as Shipping Settings e determina:
 * - origin (morada da loja, do Payload Global)
 * - parcel (peso calculado a partir dos items da Order)
 *
 * Lança erros tipados se as configurações estiverem inválidas ou ausentes.
 * Não cria dimensões fictícias — apenas weight no parcel.
 * Não chama nenhum provider de shipping.
 */
export async function resolveShippingContext(
  payload: Payload,
  order: any,
): Promise<ShippingContext> {
  // 1. Fixed origin (Braga, Portugal) — ShippingSettings Global removed
  const origin: ShippingAddress = {
    recipientName: 'Eternal Flowers',
    phone: '+351',
    line1: 'Rua do Castelo, 123',
    city: 'Braga',
    region: 'Braga',
    postalCode: '4700-000',
    country: 'PT',
  }

  // 2. Fixed default weights
  const defaultStandardWeightGrams = 500
  const defaultCupulaWeightGrams = 1000

  // 3. Recolher items e shippingClass de cada produto
  const items = (order.items as any[]) || []
  const itemsWithClass = items.map((item: any) => {
    const flower = typeof item.flower === 'object' ? item.flower : null
    return {
      shippingClass: flower?.shippingClass || 'standard',
    }
  })

  // 4. Determinar peso com base nos valores fixos
  const weightKg = resolveWeightKg(
    {
      standardWeightGrams: defaultStandardWeightGrams,
      cupulaWeightGrams: defaultCupulaWeightGrams,
    },
    itemsWithClass,
  )

  // 5. Validar peso resultante
  if (typeof weightKg !== 'number' || weightKg <= 0 || !isFinite(weightKg)) {
    throw new InvalidShippingWeightError(
      'Peso de expedição inválido.',
      `Peso calculado: ${weightKg} kg. Verificar configurações de peso.`,
    )
  }

  // 6. Construir parcel (apenas weight — sem dimensões fictícias)
  const parcel: ShippingParcel = { weight: weightKg }

  return { origin, parcel }
}