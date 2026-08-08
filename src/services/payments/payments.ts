/**
 * payments.ts — Orquestrador de pagamentos
 *
 * Responsabilidades:
 * - createPaymentForOrder() — criar/reutilizar PaymentIntent
 * - handlePaymentSucceeded() — processar payment_intent.succeeded
 * - handlePaymentFailed() — processar payment_intent.payment_failed
 * - handlePaymentProcessing() — processar payment_intent.processing
 *
 * NUNCA aceita amount/orderId/status enviados pelo browser.
 * Webhook é a única fonte de verdade para confirmação de pagamento.
 */
import type { Payload } from 'payload'
import crypto from 'crypto'
import { PAYMENT_PROVIDER, toStripeAmount, amountsMatch } from './payment-types'
import {
  PaymentError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  PaymentOrderMismatchError,
  InvalidOrderForPaymentError,
} from './payment-types'
import {
  createPaymentIntent as stripeCreateIntent,
  retrievePaymentIntent,
  checkPaymentIntentReusable,
  validatePaymentIntentForOrder,
} from './stripe'
import { runInTransaction, type TransactionCtx } from '../transact'
import { confirmReservation } from '../stock'
import type { CreatePaymentInput, CreatePaymentOutcome } from './payment-types'

// ─── Helpers ─────────────────────────────────────────────────

function generateIdempotencyKey(checkoutAttemptId: string): string {
  return crypto
    .createHash('sha256')
    .update(`payment:${checkoutAttemptId}`)
    .digest('hex')
}

// ─── createPaymentForOrder ───────────────────────────────────

/**
 * Cria (ou reutiliza) um PaymentIntent Stripe para a Order.
 *
 * Regras:
 * - Order tem de estar pending_payment
 * - total > 0
 * - currency EUR
 * - amount Stripe derivado exclusivamente server-side
 * - idempotency key derivada de checkoutAttemptId
 * - Se a Order já tiver stripePaymentIntentId, reutiliza quando possível
 */
export async function createPaymentForOrder(
  payload: Payload,
  input: CreatePaymentInput,
): Promise<CreatePaymentOutcome> {
  // ─── 1. Carregar Order server-side ─────────────────────────
  const order = await payload.findByID({
    collection: 'orders',
    id: input.orderId,
    depth: 0,
    overrideAccess: true,
  }) as any

  if (!order || !order.id) {
    throw new PaymentError(`Order ${input.orderId} não encontrada.`)
  }

  // ─── 2. Validar estado da Order ─────────────────────────────
  if (order.orderStatus !== 'pending_payment') {
    throw new InvalidOrderForPaymentError(
      `Order ${input.orderId} está "${order.orderStatus}". Apenas "pending_payment" aceita pagamento.`,
    )
  }

  // ─── 3. Validar total e currency ────────────────────────────
  const total = Number(order.total) || 0
  if (total <= 0) {
    throw new PaymentError(`Order ${input.orderId} tem total inválido (${total}).`)
  }

  const currency = order.currency || 'EUR'
  if (currency !== 'EUR') {
    throw new PaymentError(`Order ${input.orderId} tem moeda "${currency}". Apenas EUR é suportado.`)
  }

  // ─── 4. Verificar/reutilizar PaymentIntent existente ────────
  const existingPaymentIntentId = order.stripePaymentIntentId as string | undefined
  if (existingPaymentIntentId) {
    const existingIntent = await retrievePaymentIntent(existingPaymentIntentId)
    const reuseStatus = checkPaymentIntentReusable(existingIntent)

    if (reuseStatus.reusable) {
      // Validar que o amount/currency ainda correspondem
      const validation = validatePaymentIntentForOrder(existingIntent, total, currency)
      if (!validation.valid) {
        throw new PaymentAmountMismatchError(
          `PaymentIntent ${existingPaymentIntentId} não corresponde à Order. ${validation.errors.join('; ')}`,
        )
      }

      return {
        kind: 'reused',
        paymentIntentId: existingIntent.id,
        clientSecret: existingIntent.client_secret,
      }
    }

    if (reuseStatus.reason === 'already_paid') {
      // PaymentIntent já succeeded — a Order deve estar paid
      // Se não estiver, algo está inconsistente
      if (order.paymentStatus !== 'paid') {
        // Tentar recuperar — processar como succeeded
        // Isto é seguro porque o webhook pode ter falhado a entrega
        return { kind: 'reused', paymentIntentId: existingIntent.id, clientSecret: null }
      }
      return { kind: 'reused', paymentIntentId: existingIntent.id, clientSecret: null }
    }

    // PaymentIntent finalized/canceled — não reutilizável
    // A Order precisa de um novo PaymentIntent
    // Mas não podemos criar outro se o anterior está cancelado sem o fluxo correcto
    throw new PaymentError(
      `PaymentIntent ${existingPaymentIntentId} está "${existingIntent.status}" e não pode ser reutilizado.`,
    )
  }

  // ─── 5. Criar PaymentIntent Stripe ──────────────────────────
  const checkoutAttemptId = order.checkoutAttemptId as string
  const idempotencyKey = input.idempotencyKey || generateIdempotencyKey(checkoutAttemptId)

  const intent = await stripeCreateIntent({
    amount: total,
    currency,
    metadata: {
      orderId: String(order.id),
      orderNumber: order.orderNumber || '',
      checkoutAttemptId,
    },
    idempotencyKey,
  })

  // ─── 6. Guardar stripePaymentIntentId na Order ──────────────
  await payload.update({
    collection: 'orders',
    id: input.orderId,
    data: {
      stripePaymentIntentId: intent.id,
      paymentProvider: PAYMENT_PROVIDER,
    } as any,
    overrideAccess: true,
  })

  return {
    kind: 'created',
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
  }
}

// ═══════════════════════════════════════════════════════════════
// Webhook handlers
// ═══════════════════════════════════════════════════════════════

// ─── handlePaymentSucceeded ─────────────────────────────────

/**
 * Processa payment_intent.succeeded do webhook Stripe.
 *
 * Regras:
 * 1. Localizar Order através do stripePaymentIntentId (metadata fallback)
 * 2. Validar amount/currency correspondem à Order
 * 3. Idempotente — se já paid, não duplica
 * 4. Confirmar todas as stock-reservations da Order
 * 5. paymentStatus → paid
 * 6. orderStatus → confirmed
 * 7. paymentMethodType → método real
 * 8. paidAt → timestamp server-side
 */
export async function handlePaymentSucceeded(
  payload: Payload,
  paymentIntent: any,
): Promise<{ kind: string; orderId?: number }> {
  // ─── 1. Localizar Order ────────────────────────────────────
  const paymentIntentId = paymentIntent.id
  const metadataOrderId = paymentIntent.metadata?.orderId

  // Procurar por stripePaymentIntentId
  const findResult = await payload.find({
    collection: 'orders',
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let order = findResult.docs[0] as any

  // Fallback: metadata orderId
  if (!order && metadataOrderId) {
    order = await payload.findByID({
      collection: 'orders',
      id: Number(metadataOrderId),
      depth: 0,
      overrideAccess: true,
    }) as any
  }

  if (!order || !order.id) {
    return { kind: 'order_not_found' }
  }

  // ─── 2. Validar que PaymentIntent pertence à Order ──────────
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntentId) {
    throw new PaymentOrderMismatchError(
      `PaymentIntent ${paymentIntentId} não corresponde ao stripePaymentIntentId da Order ${order.id} (${order.stripePaymentIntentId}).`,
    )
  }

  // ─── 3. Validar amount/currency ─────────────────────────────
  const total = Number(order.total) || 0
  const currency = order.currency || 'EUR'

  if (!amountsMatch(paymentIntent.amount, total)) {
    throw new PaymentAmountMismatchError(
      `Amount mismatch: Stripe=${paymentIntent.amount}, Order=${order.id} total=${total} (${toStripeAmount(total)} centimos).`,
    )
  }

  if (paymentIntent.currency !== currency.toLowerCase()) {
    throw new PaymentCurrencyMismatchError(
      `Currency mismatch: Stripe=${paymentIntent.currency}, Order=${order.id} currency=${currency}.`,
    )
  }

  // ─── 4. Idempotência — já processado ───────────────────────
  if (order.paymentStatus === 'paid' && order.orderStatus === 'confirmed') {
    return { kind: 'already_processed', orderId: order.id }
  }

  // ─── 5. Operação transacional ───────────────────────────────
  return runInTransaction(payload, undefined, async (ctx) => {
    return executePaymentSucceeded(ctx, payload, order, paymentIntent)
  })
}

async function executePaymentSucceeded(
  ctx: TransactionCtx,
  payload: Payload,
  order: any,
  paymentIntent: any,
): Promise<{ kind: string; orderId: number }> {
  const now = new Date().toISOString()

  // ─── Confirmar reservas de stock ────────────────────────────
  const reservationsResult = await payload.find({
    collection: 'stock-reservations' as any,
    where: { order: { equals: order.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  for (const reservation of reservationsResult.docs as any[]) {
    if (reservation.status === 'active' || reservation.status === 'confirmed') {
      // Só confirmar se active (confirmed já foi confirmado)
      if (reservation.status === 'active') {
        await confirmReservation(payload, {
          reservationId: reservation.id,
          req: ctx.req,
        })
      }
    }
    // Reservas made_to_order não existem
    // Reservas expired/released — ignorar (já não podem ser confirmadas)
  }

  // ─── Obter payment method type ──────────────────────────────
  let paymentMethodType: string | null = null
  try {
    if (paymentIntent.payment_method_types && paymentIntent.payment_method_types.length > 0) {
      paymentMethodType = paymentIntent.payment_method_types[0]
    }
    if (paymentIntent.payment_method) {
      // Tentar obter detalhes do método de pagamento
      const paymentMethodId = paymentIntent.payment_method
      if (typeof paymentMethodId === 'string') {
        // Usar o último payment_method_type como fallback
        if (!paymentMethodType) {
          paymentMethodType = paymentIntent.payment_method_types?.[0] || null
        }
      }
    }
  } catch {
    // Melhor esforço — não bloquear se não conseguir
  }

  // ─── Actualizar Order ───────────────────────────────────────
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      paymentMethodType,
      paidAt: now,
    } as any,
    req: ctx.req,
    overrideAccess: true,
  })

  return { kind: 'processed', orderId: order.id }
}

// ─── handlePaymentFailed ─────────────────────────────────────

/**
 * Processa payment_intent.payment_failed.
 *
 * - NÃO confirma reservas
 * - paymentStatus → failed
 * - Order NÃO passa a confirmed
 * - Não liberta reservas automaticamente (expiração natural faz isso)
 */
export async function handlePaymentFailed(
  payload: Payload,
  paymentIntent: any,
): Promise<{ kind: string; orderId?: number }> {
  const paymentIntentId = paymentIntent.id

  const findResult = await payload.find({
    collection: 'orders',
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = findResult.docs[0] as any
  if (!order || !order.id) {
    return { kind: 'order_not_found' }
  }

  // Se já está paid/failed, não duplicar transição
  if (order.paymentStatus === 'failed' || order.paymentStatus === 'paid') {
    return { kind: 'already_processed', orderId: order.id }
  }

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      paymentStatus: 'failed',
      // orderStatus permanece o actual (pending_payment)
    } as any,
    overrideAccess: true,
  })

  return { kind: 'processed', orderId: order.id }
}

// ─── handlePaymentProcessing ─────────────────────────────────

/**
 * Processa payment_intent.processing.
 *
 * - paymentStatus → pending
 * - NÃO confirma stock
 */
export async function handlePaymentProcessing(
  payload: Payload,
  paymentIntent: any,
): Promise<{ kind: string; orderId?: number }> {
  const paymentIntentId = paymentIntent.id

  const findResult = await payload.find({
    collection: 'orders',
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = findResult.docs[0] as any
  if (!order || !order.id) {
    return { kind: 'order_not_found' }
  }

  // Só transicionar se vier de unpaid
  if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'pending') {
    return { kind: 'already_processed', orderId: order.id }
  }

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      paymentStatus: 'pending',
    } as any,
    overrideAccess: true,
  })

  return { kind: 'processed', orderId: order.id }
}

// ─── handlePaymentCanceled ───────────────────────────────────

/**
 * Processa payment_intent.canceled.
 *
 * - paymentStatus → failed (cancelado não é falha, mas a Order não avança)
 * - NÃO confirma stock
 */
export async function handlePaymentCanceled(
  payload: Payload,
  paymentIntent: any,
): Promise<{ kind: string; orderId?: number }> {
  const paymentIntentId = paymentIntent.id

  const findResult = await payload.find({
    collection: 'orders',
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = findResult.docs[0] as any
  if (!order || !order.id) {
    return { kind: 'order_not_found' }
  }

  if (order.paymentStatus === 'failed' || order.paymentStatus === 'paid') {
    return { kind: 'already_processed', orderId: order.id }
  }

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      paymentStatus: 'failed',
    } as any,
    overrideAccess: true,
  })

  return { kind: 'processed', orderId: order.id }
}