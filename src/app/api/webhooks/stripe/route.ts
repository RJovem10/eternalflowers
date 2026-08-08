/**
 * POST /api/webhooks/stripe — Webhook Stripe server-side
 *
 * Recebe eventos Stripe e processa-os:
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - payment_intent.processing
 * - payment_intent.canceled
 *
 * A assinatura Stripe é verificada com STRIPE_WEBHOOK_SECRET.
 * NUNCA processa webhook sem assinatura válida.
 * NUNCA aceita dados do browser.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { constructWebhookEvent } from '@/services/payments/stripe'
import {
  handlePaymentSucceeded,
  handlePaymentFailed,
  handlePaymentProcessing,
  handlePaymentCanceled,
} from '@/services/payments/payments'
import {
  PaymentOrderMismatchError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  StripeWebhookError,
} from '@/services/payments/payment-types'

export async function POST(req: NextRequest) {
  // ─── 1. Obter raw body e signature ──────────────────────────
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível ler o corpo do pedido.' },
      { status: 400 },
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Assinatura Stripe em falta.' },
      { status: 400 },
    )
  }

  // ─── 2. Verificar assinatura ─────────────────────────────────
  let event: ReturnType<typeof constructWebhookEvent>
  try {
    event = constructWebhookEvent(rawBody, signature)
  } catch (err: any) {
    console.error('[stripe-webhook] Invalid signature:', err.message)
    return NextResponse.json(
      { error: 'Assinatura inválida.' },
      { status: 401 },
    )
  }

  // ─── 3. Ignorar eventos não relevantes ───────────────────────
  const relevantEvents = new Set([
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.processing',
    'payment_intent.canceled',
  ])
  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true })
  }

  // ─── 4. Processar evento ─────────────────────────────────────
  const payload = await getPayload({ config })
  const paymentIntent = event.data.object as any

  try {
    let result: { kind: string; orderId?: number }

    switch (event.type) {
      case 'payment_intent.succeeded':
        result = await handlePaymentSucceeded(payload, paymentIntent)
        break

      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(payload, paymentIntent)
        break

      case 'payment_intent.processing':
        result = await handlePaymentProcessing(payload, paymentIntent)
        break

      case 'payment_intent.canceled':
        result = await handlePaymentCanceled(payload, paymentIntent)
        break

      default:
        // Não deve acontecer devido ao filtro acima
        return NextResponse.json({ received: true })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[stripe-webhook] Error processing event:', err.message)

    if (
      err instanceof PaymentOrderMismatchError ||
      err instanceof PaymentAmountMismatchError ||
      err instanceof PaymentCurrencyMismatchError ||
      err instanceof StripeWebhookError
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }

    // Erro inesperado — Stripe vai retentar
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 },
    )
  }
}