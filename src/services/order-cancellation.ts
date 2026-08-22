/**
 * order-cancellation.ts — Serviço de cancelamento seguro de Orders (ISSUE 1Q)
 *
 * Responsabilidade:
 *   Dar à Marina uma acção segura de cancelamento no Payload Admin.
 *
 * O serviço decide internamente entre:
 *   - pre_payment_cancel  (pending_payment → cancelled, sem reembolso)
 *   - paid_refund_cancel  (Stripe confirmed + paid → refund + cancelled)
 *   - manual_paid_refund_cancel (manual confirmed + paid → registo externo + cancelled)
 *
 * Regras:
 *   - pending_payment → pode cancelar (cancela PI se existir, liberta reservas)
 *   - Stripe confirmed + paid → REFUND INTEGRAL, antes de processing
 *   - manual confirmed + paid → exige confirmação de reembolso já feito fora do site
 *   - processing/shipped/completed → NÃO permitir
 *   - cancelled/expired → idempotente
 *   - Stripe calls FORA de DB transaction
 *   - Stock restore transaction com idempotência
 *   - NUNCA aceita amount/status do browser
 */
import type { Payload } from 'payload'
import { runInTransaction } from './transact'
import { enqueueEmailNotification, dedupKeyCancelled } from './email/email-notifications'
import { releaseReservation } from './stock'
import { lockFlowerForUpdate, lockOrderForUpdate, updateFlowerStock } from './db-adapter'
import { retrievePaymentIntent, createFullRefund, cancelPaymentIntent, listRefundsForPaymentIntent } from './payments/stripe'
import type {
  CancelOrderInput,
  CancelOrderResult,
  ManualRefundConfirmationInput,
} from './order-cancellation-types'
import {
  CancelOrderNotAllowedError,
  CancelOrderNotFoundError,
  CancelStripeError,
  CancelRefundError,
  ManualRefundConfirmationRequiredError,
} from './order-cancellation-types'
import { type TransactionCtx } from './transact'
import type { RefundReason } from './payments/payment-types'

// ─── Constantes ───────────────────────────────────────────────

const CANCELABLE_PI_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'requires_capture',
])

const FORWARD_FULFILLMENT_STATUSES = new Set([
  'processing', 'shipped', 'completed',
])

// ═══════════════════════════════════════════════════════════════
// cancelOrder — Ponto de entrada único
// ═══════════════════════════════════════════════════════════════

/**
 * Cancela uma Order.
 *
 * O serviço decide internamente a estratégia:
 *   - pending_payment / awaiting_shipping → pre_payment_cancel
 *   - Stripe confirmed + paid → paid_refund_cancel
 *   - manual confirmed + paid → manual_paid_refund_cancel
 *   - processing/shipped/completed → erro (não permitido)
 *   - já cancelled/expired → already_cancelled (idempotente)
 */
export async function cancelOrder(
  payload: Payload,
  input: CancelOrderInput,
): Promise<CancelOrderResult> {
  // ─── 1. Carregar Order ──────────────────────────────────────
  const order = await payload.findByID({
    collection: 'orders',
    id: input.orderId,
    depth: 0,
    overrideAccess: true,
  }) as any

  if (!order || !order.id) {
    throw new CancelOrderNotFoundError(input.orderId)
  }

  // ─── 2. Idempotência — já cancelada/expirada ────────────────
  if (order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
    return { kind: 'already_cancelled', orderId: input.orderId }
  }

  // ─── 3. Verificar se é cancelável ───────────────────────────
  if (FORWARD_FULFILLMENT_STATUSES.has(order.orderStatus)) {
    throw new CancelOrderNotAllowedError(
      input.orderId,
      `Order está "${order.orderStatus}". Cancelamento só permitido antes de iniciar produção.`,
    )
  }

  const paymentStatus = order.paymentStatus as string | undefined

  // ─── 4. Escolher estratégia ─────────────────────────────────
  if (order.orderStatus === 'pending_payment' || order.orderStatus === 'awaiting_shipping') {
    return prePaymentCancel(payload, order)
  }

  if (order.orderStatus === 'confirmed' && paymentStatus === 'paid') {
    if (order.paymentProvider === 'manual') {
      const confirmation = await resolveManualRefundConfirmation(payload, input)
      return manualPaidRefundCancel(payload, order, confirmation, input.req)
    }

    // Retrocompatibilidade: encomendas Stripe antigas podem não ter provider.
    if (order.paymentProvider === 'stripe' || !order.paymentProvider) {
      return paidRefundCancel(payload, order)
    }

    throw new CancelOrderNotAllowedError(
      input.orderId,
      `Provider de pagamento "${order.paymentProvider || 'desconhecido'}" não suporta cancelamento automático.`,
    )
  }

  // Outros estados (draft, confirmed+unpaid, etc.) — não cancelável
  throw new CancelOrderNotAllowedError(
    input.orderId,
    `Estado orderStatus="${order.orderStatus}" paymentStatus="${paymentStatus}" não permite cancelamento.`,
  )
}

// ═══════════════════════════════════════════════════════════════
// prePaymentCancel — Cancelamento de pré-pagamento
// ═══════════════════════════════════════════════════════════════

async function prePaymentCancel(
  payload: Payload,
  order: any,
): Promise<CancelOrderResult> {
  const orderId = order.id
  const paymentIntentId = order.stripePaymentIntentId as string | undefined

  let paymentIntentCancelled = false

  // ─── A. Tratar PaymentIntent Stripe FORA da transacção ──────
  if (paymentIntentId) {
    const cancelResult = await cancelPaymentIntent(paymentIntentId)

    if (cancelResult.canceled) {
      paymentIntentCancelled = true
    } else {
      const status = cancelResult.currentStatus

      // processing → não cancelar cegamente
      if (status === 'processing') {
        throw new CancelOrderNotAllowedError(
          orderId,
          `PaymentIntent está "${status}". Aguardar confirmação ou usar reembolso.`,
        )
      }

      // succeeded → reavaliar pelo payment lifecycle
      if (status === 'succeeded') {
        throw new CancelOrderNotAllowedError(
          orderId,
          `PaymentIntent já succeeded. Usar reembolso em vez de cancelamento pré-pagamento.`,
        )
      }

      // canceled (race) → continuar cleanup
      if (status === 'canceled') {
        paymentIntentCancelled = true
      }

      // Ainda cancelável mas cancel falhou — erro
      if (CANCELABLE_PI_STATUSES.has(status)) {
        throw new CancelStripeError(
          `PaymentIntent ${paymentIntentId} está "${status}" mas cancel falhou.`,
        )
      }
    }
  }

  // ─── B. Transaction DB curta ────────────────────────────────
  return runInTransaction(payload, undefined, async (ctx) => {
    await lockOrderForUpdate(ctx, orderId)

    // Revalidar estado
    const freshOrder = await payload.findByID({
      collection: 'orders',
      id: orderId,
      req: ctx.req,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!freshOrder) {
      throw new CancelOrderNotFoundError(orderId)
    }

    if (freshOrder.orderStatus === 'cancelled' || freshOrder.orderStatus === 'expired') {
      return { kind: 'already_cancelled', orderId }
    }

    if (!['pending_payment', 'draft', 'awaiting_shipping'].includes(freshOrder.orderStatus)) {
      throw new CancelOrderNotAllowedError(
        orderId,
        `Order mudou para "${freshOrder.orderStatus}" entre validações.`,
      )
    }

    // Libertar reservas
    const reservationsReleased = await releaseOrderReservations(ctx, payload, orderId, freshOrder.orderSource)
    const now = new Date().toISOString()

    // Marcar Order como cancelled
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        orderStatus: 'cancelled',
        cancelledAt: now,
        paymentLinkTokenHash: null,
        paymentLinkExpiresAt: null,
      } as any,
      req: ctx.req,
      overrideAccess: true,
    })

    // ─── Enqueue order_cancelled email notification (mesma transacção) ──
    // Falha ao persistir a notification faz rollback da transacção de domínio.
    const customer = (freshOrder.customer || {}) as any
    const recipientEmail = String(customer.email || freshOrder.email || '').trim()
    if (recipientEmail) await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: orderId,
      recipientEmail,
      locale: freshOrder.locale || 'pt',
      deduplicationKey: dedupKeyCancelled(orderId),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: freshOrder.orderNumber || String(orderId),
          customerName: customer.name || '',
          wasRefunded: false,
          total: Number(freshOrder.total) || 0,
          currency: freshOrder.currency || 'EUR',
        },
      },
      req: ctx.req,
    })

    return {
      kind: 'pre_payment_cancelled',
      orderId,
      paymentIntentCancelled,
      reservationsReleased,
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// manualPaidRefundCancel — Registo de reembolso executado externamente
// ═════════════════════════════════════════════════════════════

interface ResolvedManualRefundConfirmation {
  confirmedBy: number | string
  reference: string | null
}

async function resolveManualRefundConfirmation(
  payload: Payload,
  input: CancelOrderInput,
): Promise<ResolvedManualRefundConfirmation> {
  let confirmation: ManualRefundConfirmationInput | undefined = input.manualRefund

  // O endpoint Payload existente passa o request completo ao serviço. Ler o
  // corpo apenas neste ramo mantém o endpoint Stripe sem alterações.
  if (!confirmation && typeof input.req?.json === 'function') {
    try {
      const body = await input.req.json()
      if (body && typeof body === 'object' && body.manualRefund && typeof body.manualRefund === 'object') {
        confirmation = body.manualRefund as ManualRefundConfirmationInput
      }
    } catch {
      // Corpo ausente/inválido equivale a não confirmar o reembolso externo.
    }
  }

  if (confirmation?.confirmed !== true) {
    throw new ManualRefundConfirmationRequiredError(input.orderId)
  }

  const user = input.req?.user as any
  const adminUserCollection = (payload as any).config?.admin?.user as string | undefined
  if (
    user?.id === undefined ||
    user?.id === null ||
    (adminUserCollection && user.collection !== adminUserCollection)
  ) {
    throw new ManualRefundConfirmationRequiredError(
      input.orderId,
      'A confirmação do reembolso externo exige um administrador autenticado.',
    )
  }

  if (confirmation.reference !== undefined && typeof confirmation.reference !== 'string') {
    throw new CancelRefundError('A referência do reembolso externo tem de ser texto.')
  }

  const reference = confirmation.reference?.trim() || null
  if (reference && reference.length > 500) {
    throw new CancelRefundError('A referência do reembolso externo não pode exceder 500 caracteres.')
  }

  return { confirmedBy: user.id, reference }
}

async function manualPaidRefundCancel(
  payload: Payload,
  order: any,
  confirmation: ResolvedManualRefundConfirmation,
  req?: any,
): Promise<CancelOrderResult> {
  const orderId = order.id

  // Uma Order manual nunca pode provocar chamadas Stripe. Identificadores
  // Stripe neste provider indicam dados inconsistentes e bloqueiam a operação.
  if (order.stripePaymentIntentId || order.stripeRefundId) {
    throw new CancelOrderNotAllowedError(
      orderId,
      'Pagamento manual contém identificadores Stripe inesperados. Rever a encomenda antes de cancelar.',
    )
  }

  return runInTransaction(payload, req, async (ctx) => {
    // Serializa tentativas concorrentes para a mesma Order. A segunda tentativa
    // observa o estado cancelado e não restaura stock novamente.
    await lockOrderForUpdate(ctx, orderId)

    const freshOrder = await payload.findByID({
      collection: 'orders',
      id: orderId,
      req: ctx.req,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!freshOrder) {
      throw new CancelOrderNotFoundError(orderId)
    }

    if (freshOrder.orderStatus === 'cancelled' || freshOrder.orderStatus === 'expired') {
      return { kind: 'already_cancelled', orderId }
    }

    if (
      freshOrder.orderStatus !== 'confirmed' ||
      freshOrder.paymentStatus !== 'paid' ||
      freshOrder.paymentProvider !== 'manual'
    ) {
      throw new CancelOrderNotAllowedError(
        orderId,
        `Order mudou para orderStatus="${freshOrder.orderStatus}" paymentStatus="${freshOrder.paymentStatus}" provider="${freshOrder.paymentProvider}" entre validações.`,
      )
    }

    if (freshOrder.stripePaymentIntentId || freshOrder.stripeRefundId) {
      throw new CancelOrderNotAllowedError(
        orderId,
        'Pagamento manual contém identificadores Stripe inesperados. Rever a encomenda antes de cancelar.',
      )
    }

    const stockRestored = await restoreConfirmedOrderStock(ctx, payload, orderId, 'manual')
    const refundedAt = new Date().toISOString()

    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        paymentStatus: 'refunded',
        orderStatus: 'cancelled',
        refundReason: 'admin_manual_payment_refunded',
        cancelledAt: refundedAt,
        manualRefundedAt: refundedAt,
        manualRefundReference: confirmation.reference,
        manualRefundConfirmedBy: confirmation.confirmedBy,
        paymentLinkTokenHash: null,
        paymentLinkExpiresAt: null,
      } as any,
      req: ctx.req,
      overrideAccess: true,
    })

    const customer = (freshOrder.customer || {}) as any
    const recipientEmail = String(customer.email || freshOrder.email || '').trim()
    if (recipientEmail) await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId,
      recipientEmail,
      locale: freshOrder.locale || 'pt',
      deduplicationKey: dedupKeyCancelled(orderId),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: freshOrder.orderNumber || String(orderId),
          customerName: customer.name || '',
          wasRefunded: true,
          total: Number(freshOrder.total) || 0,
          currency: freshOrder.currency || 'EUR',
          paymentMethodType: freshOrder.paymentMethodType || null,
        },
      },
      req: ctx.req,
    })

    return {
      kind: 'manual_paid_refund_cancelled',
      orderId,
      stockRestored,
      refundedAt,
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// paidRefundCancel — Cancelamento pós-pagamento com reembolso
// ═══════════════════════════════════════════════════════════════

async function paidRefundCancel(
  payload: Payload,
  order: any,
): Promise<CancelOrderResult> {
  const orderId = order.id
  const paymentIntentId = order.stripePaymentIntentId as string | undefined

  if (!paymentIntentId) {
    throw new CancelOrderNotAllowedError(
      orderId,
      'Order confirmed+paid sem PaymentIntent. Contactar suporte.',
    )
  }

  // ─── A. Criar REFUND INTEGRAL FORA da transacção DB ─────────
  console.log('[order-cancel] stage=create-refund:start orderId=' + orderId)
  const refund = await createAdminCancelRefund(payload, paymentIntentId, orderId, order)
  console.log('[order-cancel] stage=create-refund:done orderId=' + orderId + ' refundId=' + refund.id)

  const refundId = refund.id
  const refundReason: RefundReason = 'admin_order_cancelled'

  // ─── B. Transaction DB curta ────────────────────────────────
  console.log('[order-cancel] stage=db-transaction:start orderId=' + orderId)
  return runInTransaction(payload, undefined, async (ctx) => {
    await lockOrderForUpdate(ctx, orderId)

    // Revalidar estado
    const freshOrder = await payload.findByID({
      collection: 'orders',
      id: orderId,
      req: ctx.req,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!freshOrder) {
      throw new CancelOrderNotFoundError(orderId)
    }

    if (freshOrder.orderStatus === 'cancelled' || freshOrder.orderStatus === 'expired') {
      return { kind: 'already_cancelled', orderId }
    }

    if (freshOrder.orderStatus !== 'confirmed' || freshOrder.paymentStatus !== 'paid') {
      throw new CancelOrderNotAllowedError(
        orderId,
        `Order mudou para orderStatus="${freshOrder.orderStatus}" paymentStatus="${freshOrder.paymentStatus}" entre validações.`,
      )
    }

    // Restaurar stock físico (unique/reproducible)
    console.log('[order-cancel] stage=stock-restore:start orderId=' + orderId)
    const stockRestored = await restoreConfirmedOrderStock(ctx, payload, orderId, freshOrder.orderSource)
    console.log('[order-cancel] stage=stock-restore:done orderId=' + orderId + ' restored=' + stockRestored)

    if (freshOrder.stripeRefundId && freshOrder.stripeRefundId !== refundId) {
      // Já tem outro refund — não sobrepor
    }

    const now = new Date().toISOString()

    console.log('[order-cancel] stage=order-update:start orderId=' + orderId)
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        paymentStatus: 'refunded',
        orderStatus: 'cancelled',
        stripeRefundId: refundId,
        refundReason,
        cancelledAt: now,
        paymentLinkTokenHash: null,
        paymentLinkExpiresAt: null,
      } as any,
      req: ctx.req,
      overrideAccess: true,
    })
    console.log('[order-cancel] stage=order-update:done orderId=' + orderId)

    // ─── Enqueue order_cancelled email notification (mesma transacção) ──
    // Falha ao persistir a notification faz rollback da transacção de domínio.
    const customer = (freshOrder.customer || {}) as any
    const recipientEmail = String(customer.email || freshOrder.email || '').trim()
    console.log('[order-cancel] stage=email-enqueue:start orderId=' + orderId)
    if (recipientEmail) await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: orderId,
      recipientEmail,
      locale: freshOrder.locale || 'pt',
      deduplicationKey: dedupKeyCancelled(orderId),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: freshOrder.orderNumber || String(orderId),
          customerName: customer.name || '',
          wasRefunded: true,
          total: Number(freshOrder.total) || 0,
          currency: freshOrder.currency || 'EUR',
          paymentMethodType: freshOrder.paymentMethodType || null,
        },
      },
      req: ctx.req,
    })
    console.log('[order-cancel] stage=email-enqueue:done orderId=' + orderId)

    return {
      kind: 'paid_refund_cancelled',
      orderId,
      refundId,
      stockRestored,
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// createAdminCancelRefund — Refund integral com idempotência
// ═══════════════════════════════════════════════════════════════

async function createAdminCancelRefund(
  payload: Payload,
  paymentIntentId: string,
  orderId: number,
  order: any,
): Promise<any> {
  // ─── 1. stripeRefundId já persistido da primeira tentativa ──
  const existingRefundId = order.stripeRefundId as string | undefined
  if (existingRefundId) {
    return { id: existingRefundId }
  }

  // ─── 2. Consultar Stripe directamente — recovery após DB failure ──
  const refunds = await listRefundsForPaymentIntent(paymentIntentId)

  // 2a. Match por metadata (post-fix — refunds com reason='admin_order_cancel')
  const adminCancelRefund = refunds.find((r) =>
    r.metadata?.reason === 'admin_order_cancel' &&
    r.metadata?.orderId === String(orderId),
  )
  if (adminCancelRefund) {
    return { id: adminCancelRefund.id }
  }

  // 2b. Se PI está totalmente reembolsado, encontrar refund que iguale
  //     o amount recebido (backward compat para refunds criados antes
  //     da metadata ser adicionada, ou recovery de qualquer origem).
  //     Isto NÃO pode confundir late-payment porque:
  //       - late-payment muda orderStatus para 'expired' (DB ok)
  //       - se DB falhou, ambas as origens são igualmente válidas
  //       - reutilizar o refund existente é correcto (não cria duplicado)
  const pi = await retrievePaymentIntent(paymentIntentId)
  const amountReceived = pi.amount_received ?? 0
  const amountRefundable = (pi as any).amount_refundable ?? 0

  if (amountRefundable <= 0 && amountReceived > 0) {
    const fullRefund = refunds.find((r) =>
      r.status === 'succeeded' && r.amount === amountReceived,
    )
    if (fullRefund) {
      return { id: fullRefund.id }
    }
  }

  // ─── 3. Fallback DB — outra Order com o mesmo PI já reembolsada ──
  // (race rara: webhook já processou refund para outra instância)
  const existingOrderWithRefund = await payload.find({
    collection: 'orders',
    where: {
      stripePaymentIntentId: { equals: paymentIntentId },
      stripeRefundId: { exists: true },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existingOrderWithRefund.docs.length > 0) {
    const refunded = existingOrderWithRefund.docs[0] as any
    return { id: refunded.stripeRefundId }
  }

  // ─── 4. Garantir que amount é exclusivamente do Stripe/Order ──
  const total = Number(order.total) || 0
  if (total <= 0) {
    throw new CancelRefundError(`Order #${orderId} tem total inválido (${total}).`)
  }

  // ─── 5. Criar refund com metadata + idempotency key ───────────
  // Metadata permite identificar inequivocamente este refund no futuro
  // Prefixo 'admin-cancel-refund' diferencia do 'late-stock-refund' do webhook
  return createFullRefund(paymentIntentId, 'admin-cancel-refund', {
    reason: 'admin_order_cancel',
    orderId: String(orderId),
  })
}

// ═══════════════════════════════════════════════════════════════
// releaseOrderReservations — Liberta reservas activas (pre-payment)
// ═══════════════════════════════════════════════════════════════

async function releaseOrderReservations(
  ctx: TransactionCtx,
  payload: Payload,
  orderId: number,
  orderSource?: string,
): Promise<boolean> {
  // Manual orders não têm reservas — nunca libertar
  if (orderSource === 'manual') return false

  const reservations = await payload.find({
    collection: 'stock-reservations' as any,
    where: {
      order: { equals: orderId },
      status: { equals: 'active' },
    },
    limit: 100,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  })

  const docs = reservations.docs as any[]
  if (docs.length === 0) return false

  for (const reservation of docs) {
    try {
      await releaseReservation(payload, {
        reservationId: reservation.id,
        req: ctx.req,
      })
    } catch {
      // Se já não está active, ignorar — idempotente
    }
  }

  return true
}

// ═══════════════════════════════════════════════════════════════
// restoreConfirmedOrderStock — Restaura stock de orders pagas
// ═══════════════════════════════════════════════════════════════

async function restoreConfirmedOrderStock(
  ctx: TransactionCtx,
  payload: Payload,
  orderId: number,
  orderSource?: string,
): Promise<boolean> {
  // Manual orders não têm reservas de stock — nunca restaurar
  if (orderSource === 'manual') return false

  const items = await payload.find({
    collection: 'stock-reservations' as any,
    where: {
      order: { equals: orderId },
      status: { equals: 'confirmed' },
    },
    pagination: false,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  })

  const confirmedReservations = [...items.docs] as any[]
  if (confirmedReservations.length === 0) return false

  // Ordem determinística de locks evita deadlocks quando há várias flores.
  confirmedReservations.sort((left, right) => {
    const leftFlowerId = typeof left.flower === 'object' ? left.flower?.id : left.flower
    const rightFlowerId = typeof right.flower === 'object' ? right.flower?.id : right.flower
    return Number(leftFlowerId) - Number(rightFlowerId) || Number(left.id) - Number(right.id)
  })

  let restoredAny = false

  for (const reservation of confirmedReservations) {
    const flowerId = typeof reservation.flower === 'object'
      ? reservation.flower.id
      : reservation.flower

    // Lock da flower
    await lockFlowerForUpdate(ctx, flowerId)

    // A lista inicial pode ficar desactualizada enquanto esperamos pelo lock.
    // Recarregar dentro da transacção impede libertar/restaurar duas vezes.
    const freshReservation = await payload.findByID({
      collection: 'stock-reservations' as any,
      id: reservation.id,
      req: ctx.req,
      depth: 0,
      overrideAccess: true,
    }) as any
    const freshOrderId = typeof freshReservation?.order === 'object'
      ? freshReservation.order?.id
      : freshReservation?.order
    const freshFlowerId = typeof freshReservation?.flower === 'object'
      ? freshReservation.flower?.id
      : freshReservation?.flower

    if (
      !freshReservation ||
      freshReservation.status !== 'confirmed' ||
      Number(freshOrderId) !== Number(orderId) ||
      Number(freshFlowerId) !== Number(flowerId)
    ) {
      continue
    }

    // Carregar flower actual
    const flower = await payload.findByID({
      collection: 'flowers',
      id: flowerId,
      req: ctx.req,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!flower) continue

    const mode = flower.productionMode as string | undefined

    const qty = freshReservation.quantity ?? 1

    if (mode === 'unique') {
      // Unique: stock era 0 (ou vendido), restaurar para 1, disponível
      await updateFlowerStock(ctx, flowerId, {
        stockQuantity: 1,
        availability: 'available',
      })
      restoredAny = true
    } else if (mode === 'reproducible') {
      // Reproducible: incrementar stock pela quantidade confirmada
      const currentStock = flower.stockQuantity ?? 0
      await updateFlowerStock(ctx, flowerId, {
        stockQuantity: currentStock + qty,
      })
      restoredAny = true
    }

    // Marcar reserva como released (não pode ser re-restaurada)
    await payload.update({
      collection: 'stock-reservations' as any,
      id: freshReservation.id,
      data: { status: 'released', releasedAt: new Date().toISOString() } as any,
      req: ctx.req,
      overrideAccess: true,
    })
  }

  return restoredAny
}
