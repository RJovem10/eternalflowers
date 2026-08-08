/**
 * checkout-finalization-types.ts — Contratos para finalização de checkout
 *
 * Tipos e erros para o serviço prepareOrderForPayment.
 */

import type { ShippingProvider } from './shipping/shipping'
import type { ShippingParcel, ShippingAddress } from './shipping/shipping-types'

// ─── Input ──────────────────────────────────────────────────

export interface PrepareOrderInput {
  /** ID da Order a finalizar */
  orderId: number
  /** Provider de shipping (server-side, nunca do browser) */
  provider: ShippingProvider
  /** Código do serviço de envio escolhido (e.g. 'STANDARD') */
  shippingServiceCode: string
  /** Parcel de envio (server-side, nunca do browser) */
  parcel: ShippingParcel
  /** Morada de origem/loja (server-side, nunca do browser) */
  origin: ShippingAddress
  /** Payload request para transacções internas */
  req?: any
}

// ─── Resultado ───────────────────────────────────────────────

export interface PrepareOrderResult {
  order: any
  /** Indica se foi criada desta vez ou reutilizada existente */
  kind: 'prepared' | 'already_prepared'
  checkoutAttemptId: string
}

// ─── Erros tipados ──────────────────────────────────────────

export class CheckoutFinalizationError extends Error {
  code = 'CHECKOUT_FINALIZATION_ERROR' as const
  constructor(msg = 'Erro na finalização do checkout.') {
    super(msg)
    this.name = 'CheckoutFinalizationError'
  }
}

export class InvalidOrderStateError extends Error {
  code = 'INVALID_ORDER_STATE' as const
  details: string
  constructor(msg: string, details: string) {
    super(msg)
    this.name = 'InvalidOrderStateError'
    this.details = details
  }
}

export class IncompatibleQuoteError extends Error {
  code = 'INCOMPATIBLE_QUOTE' as const
  constructor(msg = 'Cotação incompatível com a encomenda.') {
    super(msg)
    this.name = 'IncompatibleQuoteError'
  }
}

export class NegativeTotalError extends Error {
  code = 'NEGATIVE_TOTAL' as const
  constructor(msg = 'Total final não pode ser negativo.') {
    super(msg)
    this.name = 'NegativeTotalError'
  }
}

export class ShippingParcelNotConfiguredError extends Error {
  code = 'SHIPPING_PARCEL_NOT_CONFIGURED' as const
  constructor(msg = 'Parcel de envio não configurado.') {
    super(msg)
    this.name = 'ShippingParcelNotConfiguredError'
  }
}

export class InvalidShippingParcelError extends Error {
  code = 'INVALID_SHIPPING_PARCEL' as const
  details: string
  constructor(msg: string, details: string) {
    super(msg)
    this.name = 'InvalidShippingParcelError'
    this.details = details
  }
}