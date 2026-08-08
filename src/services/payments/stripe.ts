/**
 * stripe.ts — Integração server-side com Stripe PaymentIntents
 *
 * Responsabilidades:
 * - Criar/reutilizar PaymentIntents via Stripe SDK
 * - Verificar assinatura de webhooks
 * - Validar amount/currency do PaymentIntent contra a Order
 *
 * NUNCA expõe client_secret para armazenamento na BD.
 * NUNCA aceita amount/cliente_secret do browser.
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
    apiVersion: '2024-06-20',
    typescript: true,
  })
}

// ─── Configurar automatic payment methods ───────────────────

interface CreatePaymentIntentParams {
  amount: number       // total em EUR (float)
  currency: string     // 'EUR'
  metadata: Record<string, string>
  idempotencyKey: string
  automatic_payment_methods?: { enabled: boolean }
}

/**
 * Cria um PaymentIntent no Stripe.
 *
 * - amount é convertido para centimos automaticamente
 * - Usa automatic_payment_methods (recomendação Stripe 2025)
 * - Exclui Multibanco explicitamente
 * - Só inclui MB WAY se a conta Stripe o suportar
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<StripePaymentIntent> {
  const stripe = getStripe()

  // MB WAY será adicionado dinamicamente quando a conta Stripe o suportar

  const intent = await stripe.paymentIntents.create(
    {
      amount: toStripeAmount(params.amount),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      // Dynamic payment methods via Stripe Dashboard.
      // Multibanco não está activo no Dashboard — será adicionado em ISSUE própria.
      automatic_payment_methods: params.automatic_payment_methods ?? { enabled: true },
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