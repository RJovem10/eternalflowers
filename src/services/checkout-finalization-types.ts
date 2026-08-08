/**
 * checkout-finalization-types.ts — Contratos para finalização de checkout
 *
 * Tipos e erros para o serviço prepareOrderForPayment.
 */

// ─── Input ──────────────────────────────────────────────────

export interface PrepareOrderInput {
  /** ID da Order a finalizar */
  orderId: number
  /** Transportadora a usar (e.g. 'fake', 'ctt') */
  shippingProviderId: string
  /** Código do serviço de envio escolhido (e.g. 'STANDARD') */
  shippingServiceCode: string
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