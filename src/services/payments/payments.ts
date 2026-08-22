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
import { runInTransactionWithRetry } from '../transact'
import { lockOrderForUpdate } from '../db-adapter'
import type { CreatePaymentInput, CreatePaymentOutcome } from './payment-types'
import { SettlementStockUnavailableError, settleOrderPayment } from './payment-settlement'

// ─── Helpers ─────────────────────────────────────────────────

function generateIdempotencyKey(checkoutAttemptId: string): string {
  return crypto
    .createHash('sha256')
    .update(`payment:${checkoutAttemptId}`)
    .digest('hex')
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Gera um UUID v4 CANÓNICO, ESTÁVEL e DETERMINÍSTICO derivado do ID da Order.
 *
 * Para Orders que já têm checkoutAttemptId (UUID v4 válido), esse é reutilizado.
 * Para Orders legacy sem checkoutAttemptId, este identificador é derivado do
 * orderId via SHA-256, garantindo que:
 *   - É sempre o mesmo para a mesma Order (idempotência Stripe)
 *   - NÃO depende de randomUUID() que mudaria num retry de transacção
 *   - Tem formato UUID v4 (com bits de versão 4 e variante canónica)
 */
function deterministicCheckoutId(orderId: number): string {
  const hash = crypto
    .createHash('sha256')
    .update(`order-checkout:${orderId}`)
    .digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),   // version 4: 0100
    '8' + hash.slice(17, 20),   // variant:   10xx
    hash.slice(20, 32),
  ].join('-')
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
  return runInTransactionWithRetry(payload, input.req, async (ctx) => {
  // Impede que uma associação Stripe e uma confirmação externa avancem
  // em paralelo sobre a mesma Order.
  await lockOrderForUpdate(ctx, input.orderId)

  // ─── 1. Carregar Order server-side ─────────────────────────
  const order = await payload.findByID({
    collection: 'orders',
    id: input.orderId,
    depth: 0,
    req: ctx.req,
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
  if (!['unpaid', 'failed', 'pending'].includes(order.paymentStatus)) {
    throw new InvalidOrderForPaymentError(
      `Order ${input.orderId} tem paymentStatus "${order.paymentStatus}" e não aceita novo pagamento.`,
    )
  }
  if (order.paymentProvider && order.paymentProvider !== PAYMENT_PROVIDER) {
    throw new InvalidOrderForPaymentError('Order associada a outro provider de pagamento.')
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
  let checkoutAttemptId = typeof order.checkoutAttemptId === 'string'
    ? order.checkoutAttemptId.trim()
    : ''
  if (!UUID_V4_PATTERN.test(checkoutAttemptId)) {
    checkoutAttemptId = deterministicCheckoutId(order.id)
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { checkoutAttemptId } as any,
      req: ctx.req,
      overrideAccess: true,
    })
  }
  // Nunca confiar numa chave fornecida por um caller/browser: a chave canónica
  // deriva exclusivamente do checkoutAttemptId guardado na Order.
  const idempotencyKey = generateIdempotencyKey(checkoutAttemptId)

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
    req: ctx.req,
    overrideAccess: true,
  })

  return {
    kind: 'created',
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
  }
  })
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
  const metadataCheckoutAttemptId = paymentIntent.metadata?.checkoutAttemptId

  // Procurar por stripePaymentIntentId
  const findResult = await payload.find({
    collection: 'orders',
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let order = findResult.docs[0] as any
  const usingMetadataFallback = !order

  // O fallback só é seguro com os dois identificadores canónicos. Isto
  // cobre webhooks que chegam antes de stripePaymentIntentId ser persistido.
  if (!order) {
    if (
      typeof metadataOrderId !== 'string' ||
      !metadataOrderId ||
      typeof metadataCheckoutAttemptId !== 'string' ||
      !metadataCheckoutAttemptId
    ) {
      return { kind: 'order_not_found' }
    }
    const parsedOrderId = Number(metadataOrderId)
    if (
      !Number.isSafeInteger(parsedOrderId) ||
      parsedOrderId <= 0 ||
      String(parsedOrderId) !== metadataOrderId
    ) {
      throw new PaymentOrderMismatchError('Metadata orderId inválido.')
    }
    order = await payload.findByID({
      collection: 'orders',
      id: parsedOrderId,
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
  if (usingMetadataFallback) {
    const storedCheckoutAttemptId = typeof order.checkoutAttemptId === 'string'
      ? order.checkoutAttemptId.trim()
      : ''
    if (
      String(order.id) !== metadataOrderId ||
      !storedCheckoutAttemptId ||
      metadataCheckoutAttemptId !== storedCheckoutAttemptId
    ) {
      throw new PaymentOrderMismatchError(
        'Metadata da tentativa de pagamento não corresponde à Order.',
      )
    }
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

  if (order.paymentProvider && order.paymentProvider !== PAYMENT_PROVIDER) {
    throw new PaymentOrderMismatchError('A Order está associada a outro provider de pagamento.')
  }
  if (metadataOrderId && String(order.id) !== metadataOrderId) {
    throw new PaymentOrderMismatchError('Metadata orderId não corresponde à Order localizada.')
  }
  if (
    paymentIntent.metadata?.checkoutAttemptId &&
    order.checkoutAttemptId &&
    paymentIntent.metadata.checkoutAttemptId !== order.checkoutAttemptId
  ) {
    throw new PaymentOrderMismatchError('Metadata checkoutAttemptId não corresponde à Order.')
  }

  // ─── 4. Já refunded/expired com mesmo PaymentIntent ─────────
  if (order.paymentStatus === 'refunded' && order.orderStatus === 'expired') {
    return { kind: 'already_refunded', orderId: order.id }
  }

  const paymentMethodType = Array.isArray(paymentIntent.payment_method_types)
    ? paymentIntent.payment_method_types[0] || null
    : null

  try {
    return await settleOrderPayment(payload, {
      orderId: Number(order.id),
      payment: {
        provider: 'stripe',
        paymentIntentId,
        paymentMethodType,
      },
    })
  } catch (err) {
    if (err instanceof SettlementStockUnavailableError) {
      throw new LatePaymentError(paymentIntentId, err.message)
    }
    throw err
  }
}

// ─── handleLatePaymentRefund ────────────────────────────────

/**
 * Processa late payment: stock já não pode ser confirmado.
 * Chamado quando o settlement comum lança LatePaymentError.
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
 * Wrapper que executa o settlement de pagamento
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
