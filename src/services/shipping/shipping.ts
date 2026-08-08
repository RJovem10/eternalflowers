/**
 * shipping.ts — Serviço genérico de cotações de transporte
 *
 * Responsabilidades:
 * - Definir a interface ShippingProvider
 * - Validar input antes de chamar o provider
 * - Normalizar/validar o resultado devolvido pelo provider
 * - Rejeitar valores negativos/inválidos
 *
 * Não conhece detalhes de nenhuma transportadora em concreto.
 */

import {
  InvalidShippingInputError,
  ShippingProviderError,
  type ShippingQuote,
  type ShippingQuoteInput,
} from './shipping-types'

// ─── ISO 4217 currency codes válidos (comuns) ──────────────────

const VALID_CURRENCIES = new Set([
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'BRL', 'AUD', 'CAD', 'HKD',
])

// ─── ShippingProvider interface ────────────────────────────────

export interface ShippingProvider {
  readonly id: string
  quote(input: ShippingQuoteInput): Promise<ShippingQuote[]>
}

// ─── Validação de input ───────────────────────────────────────

function validateQuoteInput(input: ShippingQuoteInput): void {
  const errors: string[] = []

  // origin
  if (!input.origin) {
    errors.push('origin é obrigatório.')
  } else {
    if (!input.origin.country || typeof input.origin.country !== 'string') {
      errors.push('origin.country é obrigatório.')
    } else if (!/^[A-Z]{2}$/.test(input.origin.country)) {
      errors.push('origin.country deve ser ISO 3166-1 alpha-2.')
    }
    if (!input.origin.city || typeof input.origin.city !== 'string' || !input.origin.city.trim()) {
      errors.push('origin.city é obrigatório.')
    }
    if (!input.origin.line1 || typeof input.origin.line1 !== 'string' || !input.origin.line1.trim()) {
      errors.push('origin.line1 é obrigatório.')
    }
  }

  // destination
  if (!input.destination) {
    errors.push('destination é obrigatório.')
  } else {
    if (!input.destination.country || typeof input.destination.country !== 'string') {
      errors.push('destination.country é obrigatório.')
    } else if (!/^[A-Z]{2}$/.test(input.destination.country)) {
      errors.push('destination.country deve ser ISO 3166-1 alpha-2.')
    }
    if (!input.destination.city || typeof input.destination.city !== 'string' || !input.destination.city.trim()) {
      errors.push('destination.city é obrigatório.')
    }
    if (!input.destination.line1 || typeof input.destination.line1 !== 'string' || !input.destination.line1.trim()) {
      errors.push('destination.line1 é obrigatório.')
    }
  }

  // parcels
  if (!input.parcels || !Array.isArray(input.parcels) || input.parcels.length === 0) {
    errors.push('parcels não pode estar vazio.')
  } else {
    for (let i = 0; i < input.parcels.length; i++) {
      const p = input.parcels[i]
      if (typeof p.weight !== 'number' || p.weight <= 0) {
        errors.push(`parcels[${i}].weight deve ser um número positivo.`)
      }
      if (p.length !== undefined && (typeof p.length !== 'number' || p.length <= 0)) {
        errors.push(`parcels[${i}].length deve ser um número positivo.`)
      }
      if (p.width !== undefined && (typeof p.width !== 'number' || p.width <= 0)) {
        errors.push(`parcels[${i}].width deve ser um número positivo.`)
      }
      if (p.height !== undefined && (typeof p.height !== 'number' || p.height <= 0)) {
        errors.push(`parcels[${i}].height deve ser um número positivo.`)
      }
    }
  }

  // currency
  if (!input.currency || typeof input.currency !== 'string') {
    errors.push('currency é obrigatório.')
  } else {
    const normalizedCurrency = input.currency.toUpperCase()
    if (!VALID_CURRENCIES.has(normalizedCurrency)) {
      errors.push(`currency "${input.currency}" não é suportado.`)
    }
  }

  // orderValue
  if (input.orderValue !== undefined) {
    if (typeof input.orderValue !== 'number' || input.orderValue < 0) {
      errors.push('orderValue deve ser um número não negativo.')
    }
  }

  if (errors.length > 0) {
    throw new InvalidShippingInputError(errors)
  }
}

// ─── Validação dos quotes devolvidos pelo provider ─────────────

function validateQuote(quote: ShippingQuote, expectedCurrency: string): string | null {
  if (!quote.provider || typeof quote.provider !== 'string') {
    return 'quote.provider é obrigatório.'
  }
  if (!quote.serviceCode || typeof quote.serviceCode !== 'string') {
    return 'quote.serviceCode é obrigatório.'
  }
  if (!quote.serviceName || typeof quote.serviceName !== 'string') {
    return 'quote.serviceName é obrigatório.'
  }
  if (typeof quote.amount !== 'number' || quote.amount < 0) {
    return 'quote.amount deve ser um número não negativo.'
  }
  if (!quote.currency || typeof quote.currency !== 'string') {
    return 'quote.currency é obrigatório.'
  }
  if (quote.currency !== expectedCurrency) {
    return `quote.currency "${quote.currency}" não corresponde ao pedido "${expectedCurrency}".`
  }
  if (quote.estimatedMinDays !== undefined && (typeof quote.estimatedMinDays !== 'number' || quote.estimatedMinDays < 0)) {
    return 'estimatedMinDays deve ser um número não negativo.'
  }
  if (quote.estimatedMaxDays !== undefined && (typeof quote.estimatedMaxDays !== 'number' || quote.estimatedMaxDays < 0)) {
    return 'estimatedMaxDays deve ser um número não negativo.'
  }
  if (quote.estimatedMinDays !== undefined && quote.estimatedMaxDays !== undefined && quote.estimatedMinDays > quote.estimatedMaxDays) {
    return 'estimatedMinDays não pode ser maior que estimatedMaxDays.'
  }
  return null
}

// ─── getShippingQuotes ─────────────────────────────────────────

export async function getShippingQuotes(
  provider: ShippingProvider,
  input: ShippingQuoteInput,
): Promise<ShippingQuote[]> {
  // 1. Validar input
  validateQuoteInput(input)

  // 2. Normalizar input antes de passar ao provider
  const normalizedInput: ShippingQuoteInput = {
    ...input,
    currency: input.currency.toUpperCase(),
  }

  // 3. Chamar provider
  let rawQuotes: ShippingQuote[]
  try {
    rawQuotes = await provider.quote(normalizedInput)
  } catch (err) {
    // Erros do provider propagam sem expor detalhes internos
    throw new ShippingProviderError(
      `Erro ao obter cotações de ${provider.id}.`,
    )
  }

  // 4. Validar resultado
  if (!Array.isArray(rawQuotes)) {
    throw new ShippingProviderError(
      `Provider ${provider.id} devolveu resultado inválido.`,
    )
  }

  for (const quote of rawQuotes) {
    const validationError = validateQuote(quote, normalizedInput.currency)
    if (validationError) {
      throw new ShippingProviderError(
        `Provider ${provider.id} devolveu cotação inválida: ${validationError}`,
      )
    }
  }

  return rawQuotes
}