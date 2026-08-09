/**
 * order-fulfillment-types.ts — Contratos de domínio para fulfillment de Orders
 *
 * Define inputs, outcomes e erros para o serviço de fulfillment.
 */

// ─── Inputs ──────────────────────────────────────────────────

export interface StartProcessingInput {
  /** ID da Order */
  orderId: number
  /** Payload request para transacções internas */
  req?: any
}

export interface MarkShippedInput {
  /** ID da Order */
  orderId: number
  /** Código de tracking opcional (referência operacional) */
  trackingNumber?: string
  /** Payload request para transacções internas */
  req?: any
}

export interface CompleteOrderInput {
  /** ID da Order */
  orderId: number
  /** Payload request para transacções internas */
  req?: any
}

// ─── Resultados ──────────────────────────────────────────────

export type FulfillmentResult =
  | { kind: 'processing_started'; orderId: number; processingAt: string }
  | { kind: 'already_processing'; orderId: number }
  | { kind: 'shipped'; orderId: number; shippedAt: string; trackingNumber?: string | null }
  | { kind: 'already_shipped'; orderId: number }
  | { kind: 'completed'; orderId: number; completedAt: string }
  | { kind: 'already_completed'; orderId: number }

// ─── Erros tipados ──────────────────────────────────────────

export class InvalidOrderTransitionError extends Error {
  code = 'INVALID_ORDER_TRANSITION' as const
  constructor(from: string, to: string) {
    super(`Transição inválida: "${from}" → "${to}".`)
    this.name = 'InvalidOrderTransitionError'
  }
}

export class OrderNotPaidError extends Error {
  code = 'ORDER_NOT_PAID' as const
  constructor(orderId: number, paymentStatus: string) {
    super(`Order #${orderId} não está paga (paymentStatus="${paymentStatus}").`)
    this.name = 'OrderNotPaidError'
  }
}

export class TrackingConflictError extends Error {
  code = 'TRACKING_CONFLICT' as const
  constructor(orderId: number, existing: string, attempted: string) {
    super(`Order #${orderId} já tem trackingNumber="${existing}". Não é possível substituir por "${attempted}".`)
    this.name = 'TrackingConflictError'
  }
}

export class OrderNotFoundError extends Error {
  code = 'ORDER_NOT_FOUND' as const
  constructor(orderId: number) {
    super(`Order #${orderId} não encontrada.`)
    this.name = 'OrderNotFoundError'
  }
}