/**
 * stripe.ts — Integração server-side com Stripe PaymentIntents
 *
 * Responsabilidades:
 * - Criar/reutilizar PaymentIntents via Stripe SDK
 * - Verificar assinatura de webhooks
 * - Validar amount/currency do PaymentIntent contra a Order
 * - Criar refunds para late payments
 *
 * NUNCA expõe client_secret para armazenamento na BD.
 * NUNCA aceita amount/cliente_secret do browser.
 *
 * ISSUE-1I: Stripe API 2025-10-29.clover (stripe-node 19.2.0)
 * MB WAY suportado oficialmente como payment_method_type.
 */
import Stripe from 'stripe'
import { toStripeAmount } from './payment-types'

// ─── Inicialização do SDK (server-side apenas) ──────────────

type StripePaymentIntent = Stripe.PaymentIntent

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY não configurada.')
  }
  return new Stripe(key, {
    apiVersion: '2025-10-29.clover',
    typescript: true,
  })
}

// ─── Payment method types V1 ────────────────────────────────
//
// Política de stock: reservas curtas (30 min).
// Apenas métodos com confirmação imediata.
// Multibanco (confirmação diferida) será adicionado em ISSUE própria.
//
// Apple Pay / Google Pay continuam disponíveis através do suporte
// wallet/card quando Stripe/browser os considerar elegíveis.

const SUPPORTED_PAYMENT_METHODS = ['card', 'mb_way', 'link'] as const

type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number]

// ─── Create PaymentIntent ───────────────────────────────────

interface CreatePaymentIntentParams {
  amount: number       // total em EUR (float)
  currency: string     // 'EUR'
  metadata: Record<string, string>
  idempotencyKey: string
}

/**
 * Cria um PaymentIntent no Stripe.
 *
 * - amount é convertido para centimos automaticamente
 * - payment_method_types explícitos: card, mb_way, link
 * - NÃO usa automatic_payment_methods (risco de delayed methods)
 * - Multibanco NÃO incluído nesta versão
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<StripePaymentIntent> {
  const stripe = getStripe()

  const intent = await stripe.paymentIntents.create(
    {
      amount: toStripeAmount(params.amount),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      payment_method_types: [...SUPPORTED_PAYMENT_METHODS],
    },
    {
      idempotencyKey: params.idempotencyKey,
    },
  )

  return intent
}

// ─── Recuperar PaymentIntent existente ──────────────────────

export async function retrievePaymentIntent(
  paymentIntentId: string,
): Promise<StripePaymentIntent> {
  const stripe = getStripe()
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

// ─── Verificar se PaymentIntent pode ser reutilizado ────────

const REUSABLE_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
])

/**
 * Verifica se um PaymentIntent pode ser reutilizado.
 * PaymentIntents já succeeded/canceled NÃO são reutilizados.
 * Se succeeded, a Order já deve estar paid — retorna 'already_paid'.
 */
export type PaymentIntentReuseStatus =
  | { reusable: true; paymentIntent: StripePaymentIntent }
  | { reusable: false; reason: 'already_paid' | 'finalized' }

export function checkPaymentIntentReusable(
  paymentIntent: StripePaymentIntent,
): PaymentIntentReuseStatus {
  if (paymentIntent.status === 'succeeded') {
    return { reusable: false, reason: 'already_paid' }
  }

  if (!REUSABLE_STATUSES.has(paymentIntent.status)) {
    return { reusable: false, reason: 'finalized' }
  }

  return { reusable: true, paymentIntent }
}

// ─── Validar correspondência amount/currency ────────────────

export interface PaymentIntentValidation {
  valid: boolean
  errors: string[]
}

export function validatePaymentIntentForOrder(
  paymentIntent: StripePaymentIntent,
  orderTotal: number,
  orderCurrency: string,
): PaymentIntentValidation {
  const errors: string[] = []

  const expectedAmount = toStripeAmount(orderTotal)
  if (paymentIntent.amount !== expectedAmount) {
    errors.push(
      `Amount mismatch: PaymentIntent=${paymentIntent.amount} (${paymentIntent.currency}), ` +
      `esperado=${expectedAmount} (${orderCurrency.toLowerCase()})`,
    )
  }

  if (paymentIntent.currency !== orderCurrency.toLowerCase()) {
    errors.push(
      `Currency mismatch: PaymentIntent=${paymentIntent.currency}, ` +
      `esperado=${orderCurrency.toLowerCase()}`,
    )
  }

  return { valid: errors.length === 0, errors }
}

// ─── Refund (late payment) ──────────────────────────────────

/**
 * Cria um refund integral do PaymentIntent Stripe.
 *
 * Usa idempotency key estável derivada do paymentIntentId para
 * que webhooks repetidos não criem refunds duplicados.
 *
 * Aceita um parâmetro opcional `idempotencyKeyPrefix` para que
 * o cancelamento admin use chave diferente do late-payment refund.
 * Aceita `metadata` opcional para identificar a origem do refund.
 *
 * @param paymentIntentId - ID do PaymentIntent a reembolsar
 * @param idempotencyKeyPrefix - Prefixo da idempotency key. Default: 'late-stock-refund'
 * @param metadata - Metadados opcionais para identificar o refund (ex: reason, orderId)
 */
export async function createFullRefund(
  paymentIntentId: string,
  idempotencyKeyPrefix?: string,
  metadata?: Record<string, string>,
): Promise<Stripe.Refund> {
  const stripe = getStripe()

  const prefix = idempotencyKeyPrefix ?? 'late-stock-refund'
  const idempotencyKey = `${prefix}:${paymentIntentId}`

  return stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(metadata ? { metadata } : {}),
    },
    {
      idempotencyKey,
    },
  )
}

// ─── Listar refunds de um PaymentIntent ─────────────────────

/**
 * Lista todos os refunds associados a um PaymentIntent no Stripe.
 *
 * Útil para recuperação após DB failure: se o stripeRefundId não foi
 * persistido na Order, podemos consultar a Stripe directamente para
 * encontrar o refund criado anteriormente.
 *
 * @param paymentIntentId - ID do PaymentIntent
 */
export async function listRefundsForPaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.Refund[]> {
  const stripe = getStripe()
  const refunds = await stripe.refunds.list({
    payment_intent: paymentIntentId,
    limit: 100,
  })
  return refunds.data
}

// ─── Webhook signature verification ─────────────────────────

export function constructWebhookEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET não configurada.')
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}


// ─── Cancel PaymentIntent (idempotente) ─────────────────────

/**
 * Cancela um PaymentIntent de forma idempotente.
 *
 * Usa idempotency key estável derivada do paymentIntentId:
 *   expire-order:{paymentIntentId}
 *
 * Se o PI já estiver canceled (por qualquer via), recupera o estado
 * e devolve sucesso lógico.
 * Se o PI mudou para processing/succeeded entretanto, retorna o
 * estado actual para o caller decidir.
 */
export async function cancelPaymentIntent(
  paymentIntentId: string,
): Promise<
  | { canceled: true }
  | { canceled: false; currentStatus: string }
> {
  const stripe = getStripe()
  const idempotencyKey = `expire-order:${paymentIntentId}`

  try {
    await stripe.paymentIntents.cancel(
      paymentIntentId,
      {},
      { idempotencyKey },
    )
    return { canceled: true }
  } catch (err: any) {
    // Pode ter falhado por race (PI já não cancelável).
    // Recuperar estado actual para decidir.
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (pi.status === 'canceled') {
        return { canceled: true }
      }
      return { canceled: false, currentStatus: pi.status }
    } catch {
      // Se retrieve também falhar, propagar o erro original
      throw err
    }
  }
}

// ─── Supported payment methods (export for tests) ───────────

export function getSupportedPaymentMethods(): readonly string[] {
  return SUPPORTED_PAYMENT_METHODS
}