/**
 * shipping-types.ts — Contratos de domínio para cotações de transporte
 *
 * Tipos genéricos, independentes de qualquer transportadora.
 */

// ─── Address ──────────────────────────────────────────────────

export interface ShippingAddress {
  recipientName: string
  phone?: string
  line1: string
  line2?: string
  city: string
  region?: string
  postalCode?: string
  country: string // ISO 3166-1 alpha-2
}

// ─── Parcel ───────────────────────────────────────────────────

export interface ShippingParcel {
  weight: number // kg
  length?: number
  width?: number
  height?: number
}

// ─── Quote input ──────────────────────────────────────────────

export interface ShippingQuoteInput {
  origin: ShippingAddress
  destination: ShippingAddress
  parcels: ShippingParcel[]
  currency: string // ISO 4217
  orderValue?: number
}

// ─── Quote output ─────────────────────────────────────────────

export interface ShippingQuote {
  provider: string
  serviceCode: string
  serviceName: string
  amount: number
  currency: string // ISO 4217
  estimatedMinDays?: number
  estimatedMaxDays?: number
}

// ─── Erros tipados ────────────────────────────────────────────

export class InvalidShippingInputError extends Error {
  code = 'INVALID_SHIPPING_INPUT' as const
  details: string[]
  constructor(details: string[]) {
    super(details.join('; '))
    this.name = 'InvalidShippingInputError'
    this.details = details
  }
}

export class ShippingProviderNotConfiguredError extends Error {
  code = 'SHIPPING_PROVIDER_NOT_CONFIGURED' as const
  constructor(msg = 'Transportadora não configurada.') {
    super(msg)
    this.name = 'ShippingProviderNotConfiguredError'
  }
}

export class ShippingProviderError extends Error {
  code = 'SHIPPING_PROVIDER_ERROR' as const
  constructor(msg = 'Erro na transportadora.') {
    super(msg)
    this.name = 'ShippingProviderError'
  }
}