/**
 * payment-types.ts — Contratos de domínio para pagamentos Stripe
 *
 * Define os tipos, inputs, outcomes e erros para o serviço de pagamentos.
 * NUNCA expõe client_secret ou dados sensíveis.
 *
 * ISSUE-1I: adiciona ReservationSettlementOutcome, LatePaymentError,
 * refund-related types.
 */
// ─── Payment Provider ───────────────────────────────────────

export const PAYMENT_PROVIDER = 'stripe'

export type PaymentMethodType = string | null

// ─── createPaymentForOrder input ────────────────────────────

export interface CreatePaymentInput {
  orderId: number
  /** Idempotência derivada de checkoutAttemptId */
  idempotencyKey: string
  req?: any
}

// ─── createPaymentForOrder outcome ──────────────────────────

export type CreatePaymentOutcome =
  | { kind: 'created'; paymentIntentId: string; clientSecret: string | null }
  | { kind: 'reused'; paymentIntentId: string; clientSecret: string | null }

// ─── Webhook processed outcome ──────────────────────────────

export type WebhookProcessOutcome =
  | { kind: 'skipped'; reason: string }
  | { kind: 'processed'; eventId: string; orderId: number }

// ─── Reservation settlement outcomes ───────────────────────
// ISSUE-1I: outcomes da verificação de reservas no webhook succeeded

export type ReservationSettlementOutcome =
  // Todas as reservas confirmadas → pode prosseguir
  | { kind: 'all_confirmed' }
  // Pelo menos uma reserva não pôde ser confirmada → late payment
  | { kind: 'settlement_failed'; reason: 'expired' | 'released' | 'missing' }
  // Nenhuma reserva necessária (made_to_order)
  | { kind: 'no_reservations_needed' }

// ─── Refund snapshot ───────────────────────────────────────

export type RefundReason = 'stock_reservation_expired' | 'admin_order_cancelled'

// ─── Erros tipados ──────────────────────────────────────────

export class PaymentError extends Error {
  code = 'PAYMENT_ERROR' as const
  constructor(msg = 'Erro de pagamento.') {
    super(msg)
    this.name = 'PaymentError'
  }
}

export class PaymentAmountMismatchError extends Error {
  code = 'PAYMENT_AMOUNT_MISMATCH' as const
  constructor(msg = 'Valor do pagamento não corresponde ao valor da encomenda.') {
    super(msg)
    this.name = 'PaymentAmountMismatchError'
  }
}

export class PaymentCurrencyMismatchError extends Error {
  code = 'PAYMENT_CURRENCY_MISMATCH' as const
  constructor(msg = 'Moeda do pagamento não corresponde à moeda da encomenda.') {
    super(msg)
    this.name = 'PaymentCurrencyMismatchError'
  }
}

export class PaymentOrderMismatchError extends Error {
  code = 'PAYMENT_ORDER_MISMATCH' as const
  constructor(msg = 'PaymentIntent não pertence à encomenda indicada.') {
    super(msg)
    this.name = 'PaymentOrderMismatchError'
  }
}

export class InvalidOrderForPaymentError extends Error {
  code = 'INVALID_ORDER_FOR_PAYMENT' as const
  constructor(msg = 'Encomenda não está em estado válido para pagamento.') {
    super(msg)
    this.name = 'InvalidOrderForPaymentError'
  }
}

export class StripeWebhookError extends Error {
  code = 'STRIPE_WEBHOOK_ERROR' as const
  constructor(msg = 'Erro no processamento do webhook Stripe.') {
    super(msg)
    this.name = 'StripeWebhookError'
  }
}

export class StripeSignatureError extends Error {
  code = 'STRIPE_SIGNATURE_ERROR' as const
  constructor(msg = 'Assinatura do webhook Stripe inválida.') {
    super(msg)
    this.name = 'StripeSignatureError'
  }
}

/**
 * ISSUE-1I: Erro específico para late payment — stock expirou
 * antes do pagamento ser processado.
 */
export class LatePaymentError extends Error {
  code = 'LATE_PAYMENT_STOCK_EXPIRED' as const
  paymentIntentId: string
  constructor(paymentIntentId: string, msg = 'Stock expirou antes da confirmação do pagamento.') {
    super(msg)
    this.name = 'LatePaymentError'
    this.paymentIntentId = paymentIntentId
  }
}

/**
 * ISSUE-1I: Erro de reserva expirada no payment session guard.
 */
export class PaymentReservationExpiredError extends Error {
  code = 'PAYMENT_RESERVATION_EXPIRED' as const
  constructor(msg = 'Reserva de stock expirou. Cliente deve reiniciar checkout.') {
    super(msg)
    this.name = 'PaymentReservationExpiredError'
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/** Converte valor EUR (float) para centimos (inteiro Stripe) */
export function toStripeAmount(amount: number): number {
  return Math.round(amount * 100)
}

/** Verifica se um valor em centimos Stripe corresponde ao valor da Order */
export function amountsMatch(stripeAmount: number, orderTotal: number): boolean {
  return stripeAmount === toStripeAmount(orderTotal)
}

/**
 * ISSUE-1I: Stripe API 2025-10-29.clover com payment_method_types explícitos.
 * [card, mb_way, link] — confirmação imediata.
 * Multibanco será adicionado em ISSUE própria com suporte a confirmação diferida.
 */