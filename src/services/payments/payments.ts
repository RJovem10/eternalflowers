/**
 * payments.ts — Orquestrador de pagamentos
 *
 * Responsabilidades:
 * - createPaymentForOrder() — criar/reutilizar PaymentIntent
 * - handlePaymentSucceeded() — processar payment_intent.succeeded
 * - handlePaymentFailed() — processar payment_intent.payment_failed
 * - handlePaymentProcessing() — processar payment_intent.processing
 *
 * ISSUE-1I:
 * - succeeded verifica TODAS as reservas antes de marcar paid/confirmed
 * - reservation expired/released → late payment refund automático
 * - refund idempotente (stripeRefundId único, idempotency key estável)
 * - NUNCA paid/confirmed sem stock confirmado
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
  LatePaymentError,
} from './payment-types'
import type { RefundReason } from './payment-types'
import {
  createPaymentIntent as stripeCreateIntent,
  retrievePaymentIntent,
  checkPaymentIntentReusable,
  validatePaymentIntentForOrder,
  createFullRefund,
} from './stripe'
import { runInTransaction, runInTransactionWithRetry, type TransactionCtx } from '../transact'
import { confirmReservation } from '../stock'
import type { ConfirmReservationOutcome } from '../stock-types'
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
 * Regras ISSUE-1I:
 * 1. Localizar Order através do stripePaymentIntentId (metadata fallback)
 * 2. Validar amount/currency correspondem à Order
 * 3. Idempotente — se já paid+confirmed, já_processed
 * 4. Se já refunded/expired com mesmo PaymentIntent → already_refunded
 * 5. DENTRO da transacção: verificar TODAS as reservas necessárias
 * 6. Se todas confirmam → paid/confirmed + stock confirmado
 * 7. Se alguma falha (expired/released/missing) → rollback + late payment refund
 * 8. made_to_order-only → sem reservas, prossegue normalmente
 * 9. paymentMethodType → método real
 * 10. paidAt → timestamp server-side
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

  // ─── 4. Idempotência — já processado com sucesso ───────────
  if (order.paymentStatus === 'paid' && order.orderStatus === 'confirmed') {
    return { kind: 'already_processed', orderId: order.id }
  }

  // ─── 4b. Já refunded/expired com mesmo PaymentIntent ───────
  if (order.paymentStatus === 'refunded' && order.orderStatus === 'expired') {
    return { kind: 'already_refunded', orderId: order.id }
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

  // ─── Verificar todas as reservas necessárias ────────────────
  const reservationsResult = await payload.find({
    collection: 'stock-reservations' as any,
    where: { order: { equals: order.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const reservations = reservationsResult.docs as any[]
  const items = (order.items as any[]) || []

  // Determinar se há items reserváveis
  const hasReservableItem = items.some((item: any) => {
    const mode = item.productionMode
    return mode === 'unique' || mode === 'reproducible' || mode === null || mode === undefined
  })

  // Se há items que precisam de reserva, verificar
  if (hasReservableItem) {
    // Verificar se cada item reservável tem uma reserva
    for (const item of items) {
      const mode = item.productionMode
      if (mode === 'made_to_order') continue

      const flowerId = typeof item.flower === 'object' ? item.flower.id : item.flower
      const hasReservation = reservations.some((r: any) => {
        const rFlowerId = typeof r.flower === 'object' ? r.flower.id : r.flower
        return rFlowerId === flowerId
      })

      if (!hasReservation) {
        throw new LatePaymentError(
          paymentIntent.id,
          `Item flowerId=${flowerId} não tem reserva associada.`,
        )
      }
    }

    // Tentar confirmar TODAS as reservas
    const outcomes: Array<{ reservationId: number; result: ConfirmReservationOutcome }> = []

    for (const reservation of reservations) {
      try {
        const result = await confirmReservation(payload, {
          reservationId: reservation.id,
          req: ctx.req,
        })
        outcomes.push({ reservationId: reservation.id, result })
      } catch (err: any) {
        // Erro de dominío (StockInvariantViolation, etc.) — rollback total
        throw new PaymentError(
          `Falha ao confirmar reserva ${reservation.id}: ${err.message}`,
        )
      }
    }

    // Verificar outcomes
    // Aceitáveis: confirmed, already_confirmed
    // Inaceitáveis: expired_now, terminated (expired/released)
    for (const outcome of outcomes) {
      if (outcome.result.kind === 'confirmed' || outcome.result.kind === 'already_confirmed') {
        continue // OK
      }

      if (outcome.result.kind === 'expired_now') {
        // Reserva expirou neste exato momento — late payment
        throw new LatePaymentError(
          paymentIntent.id,
          `Reserva ${outcome.reservationId} expirou antes da confirmação do pagamento.`,
        )
      }

      if (outcome.result.kind === 'terminated') {
        // Reserva já estava expired/released — late payment
        throw new LatePaymentError(
          paymentIntent.id,
          `Reserva ${outcome.reservationId} está ${outcome.result.status} (não pode ser confirmada).`,
        )
      }
    }
  }

  // ─── Se chegámos aqui, stock está confirmado ───────────────

  // ─── Obter payment method type ──────────────────────────────
  let paymentMethodType: string | null = null
  try {
    if (paymentIntent.payment_method_types && paymentIntent.payment_method_types.length > 0) {
      paymentMethodType = paymentIntent.payment_method_types[0]
    }
    if (paymentIntent.payment_method) {
      const paymentMethodId = paymentIntent.payment_method
      if (typeof paymentMethodId === 'string') {
        if (!paymentMethodType) {
          paymentMethodType = paymentIntent.payment_method_types?.[0] || null
        }
      }
    }
  } catch {
    // Melhor esforço — não bloquear se não conseguir
  }

  // ─── Actualizar Order: paid + confirmed ─────────────────────
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

// ─── handleLatePaymentRefund ────────────────────────────────

/**
 * Processa late payment: stock já não pode ser confirmado.
 * Chamado quando executePaymentSucceeded lança LatePaymentError.
 *
 * Fluxo (fora da transacção original que foi rolled back):
 * A. Criar refund Stripe FORA da DB transaction
 * B. Transaction curta para marcar Order como refunded/expired
 * C. Idempotente: se stripeRefundId já existe, não duplica
 */
export async function handleLatePaymentRefund(
  payload: Payload,
  paymentIntentId: string,
  orderId: number,
): Promise<{ kind: string; refundId?: string }> {
  // ─── 1. Carregar Order actual ───────────────────────────────
  const order = await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as any

  if (!order || !order.id) {
    return { kind: 'order_not_found' }
  }

  // ─── 2. Idempotência — já processado ────────────────────────
  if (order.stripeRefundId) {
    return { kind: 'already_refunded', refundId: order.stripeRefundId }
  }

  // ─── 3. Criar refund Stripe (FORA da transacção DB) ─────────
  let refund: any
  try {
    refund = await createFullRefund(paymentIntentId)
  } catch (err: any) {
    console.error('[payments] Late payment refund failed:', err.message)
    throw new PaymentError(`Falha ao criar refund Stripe: ${err.message}`)
  }

  const refundId = refund.id
  const refundReason: RefundReason = 'stock_reservation_expired'

  // ─── 4. Transaction curta para persistir refund ─────────────
  // Usamos uma transaction própria — se falhar, o webhook retry
  // reutiliza a idempotency key do Stripe (mesmo refund) e tenta
  // novamente a DB transaction.
  try {
    await runInTransactionWithRetry(payload, undefined, async (ctx) => {
      // Re-verificar idempotência dentro da transacção
      const freshOrder = await payload.findByID({
        collection: 'orders',
        id: orderId,
        req: ctx.req,
        depth: 0,
        overrideAccess: true,
      }) as any

      if (freshOrder?.stripeRefundId) {
        // Já foi actualizado por outro webhook — sair sem erro
        return
      }

      await payload.update({
        collection: 'orders',
        id: orderId,
        data: {
          paymentStatus: 'refunded',
          orderStatus: 'expired',
          stripeRefundId: refundId,
          refundReason,
        } as any,
        req: ctx.req,
        overrideAccess: true,
      })
    })
  } catch (err: any) {
    console.error('[payments] Failed to persist late payment refund state:', err.message)
    // Stripe refund já foi criado — webhook retry vai reutilizar
    // O refund existe no Stripe (idempotency key), e a DB transaction
    // pode ser retentada
    throw err
  }

  return { kind: 'refunded', refundId }
}

// ─── handlePaymentSucceededWithFallback ─────────────────────

/**
 * Wrapper que executa executePaymentSucceeded dentro de transacção
 * e trata LatePaymentError com refund automático.
 *
 * Usado pelo webhook route para garantir que late payments são
 * sempre reembolsados.
 */
export async function handlePaymentSucceededWithFallback(
  payload: Payload,
  paymentIntent: any,
): Promise<{ kind: string; orderId?: number; refundId?: string }> {
  try {
    // Tentar processamento normal (incluindo confirmação de stock)
    return await handlePaymentSucceeded(payload, paymentIntent)
  } catch (err: any) {
    if (err instanceof LatePaymentError) {
      // Stock expirou — fazer refund
      const paymentIntentId = err.paymentIntentId

      // Localizar Order pelo paymentIntent
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

      const refundResult = await handleLatePaymentRefund(payload, paymentIntentId, order.id)
      return {
        kind: 'late_payment_refunded',
        orderId: order.id,
        refundId: refundResult.refundId,
      }
    }

    // Outro erro — propagar
    throw err
  }
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