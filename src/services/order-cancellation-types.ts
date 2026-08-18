/**
 * order-cancellation-types.ts — Contratos de domínio para cancelamento de Orders
 *
 * Define inputs, outcomes e erros para o serviço de cancelamento seguro
 * de encomendas (ISSUE 1Q).
 */

// ─── Inputs ──────────────────────────────────────────────────

export interface CancelOrderInput {
  /** ID da Order */
  orderId: number
  /** Payload request para transacções internas */
  req?: any
}

// ─── Resultados ──────────────────────────────────────────────

export type CancelOrderResult =
  // Cancelamento de pré-pagamento (pending_payment)
  | {
      kind: 'pre_payment_cancelled'
      orderId: number
      paymentIntentCancelled: boolean
      reservationsReleased: boolean
    }
  // Cancelamento pós-pagamento com reembolso (confirmed + paid)
  | {
      kind: 'paid_refund_cancelled'
      orderId: number
      refundId: string
      stockRestored: boolean
    }
  // Order já estava cancelada (idempotente)
  | { kind: 'already_cancelled'; orderId: number }
  // Order não pode ser cancelada (estado inválido)
  | { kind: 'not_cancelable'; orderId: number; reason: string }

// ─── Erros tipados ──────────────────────────────────────────

export class CancelOrderNotAllowedError extends Error {
  code = 'CANCEL_NOT_ALLOWED' as const
  constructor(orderId: number, reason: string) {
    super(`Order #${orderId} não pode ser cancelada: ${reason}`)
    this.name = 'CancelOrderNotAllowedError'
  }
}

export class CancelOrderNotFoundError extends Error {
  code = 'CANCEL_ORDER_NOT_FOUND' as const
  constructor(orderId: number) {
    super(`Order #${orderId} não encontrada.`)
    this.name = 'CancelOrderNotFoundError'
  }
}

export class CancelStripeError extends Error {
  code = 'CANCEL_STRIPE_ERROR' as const
  constructor(msg: string) {
    super(msg)
    this.name = 'CancelStripeError'
  }
}

export class CancelRefundError extends Error {
  code = 'CANCEL_REFUND_ERROR' as const
  constructor(msg: string) {
    super(msg)
    this.name = 'CancelRefundError'
  }
}