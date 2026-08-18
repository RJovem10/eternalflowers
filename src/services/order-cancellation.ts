/**
 * order-cancellation.ts — Serviço de cancelamento seguro de Orders (ISSUE 1Q)
 *
 * Responsabilidade:
 *   Dar à Marina uma acção segura de cancelamento no Payload Admin.
 *
 * O serviço decide internamente entre:
 *   - pre_payment_cancel  (pending_payment → cancelled, sem reembolso)
 *   - paid_refund_cancel  (confirmed + paid → refund + cancelled)
 *
 * Regras:
 *   - pending_payment → pode cancelar (cancela PI se existir, liberta reservas)
 *   - confirmed + paid → pode cancelar com REFUND INTEGRAL, antes de processing
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
import { lockFlowerForUpdate, updateFlowerStock } from './db-adapter'
import { retrievePaymentIntent, createFullRefund, cancelPaymentIntent, listRefundsForPaymentIntent } from './payments/stripe'
import type {
  CancelOrderInput,
  CancelOrderResult,
} from './order-cancellation-types'
import {
  CancelOrderNotAllowedError,
  CancelOrderNotFoundError,
  CancelStripeError,
  CancelRefundError,
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
 *   - pending_payment → pre_payment_cancel
 *   - confirmed + paid → paid_refund_cancel
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
  if (order.orderStatus === 'pending_payment') {
    return prePaymentCancel(payload, order)
  }

  if (order.orderStatus === 'confirmed' && paymentStatus === 'paid') {
    return paidRefundCancel(payload, order)
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

    if (!['pending_payment', 'draft'].includes(freshOrder.orderStatus)) {
      throw new CancelOrderNotAllowedError(
        orderId,
        `Order mudou para "${freshOrder.orderStatus}" entre validações.`,
      )
    }

    // Libertar reservas
    const reservationsReleased = await releaseOrderReservations(ctx, payload, orderId)
    const now = new Date().toISOString()

    // Marcar Order como cancelled
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        orderStatus: 'cancelled',
        cancelledAt: now,
      } as any,
      req: ctx.req,
      overrideAccess: true,
    })

    // ─── Enqueue order_cancelled email notification (mesma transacção) ──
    // Falha ao persistir a notification faz rollback da transacção de domínio.
    const customer = (freshOrder.customer || {}) as any
    await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: orderId,
      recipientEmail: customer.email || freshOrder.email || '',
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
  const refund = await createAdminCancelRefund(payload, paymentIntentId, orderId, order)

  const refundId = refund.id
  const refundReason: RefundReason = 'admin_order_cancelled'

  // ─── B. Transaction DB curta ────────────────────────────────
  return runInTransaction(payload, undefined, async (ctx) => {
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
    const stockRestored = await restoreConfirmedOrderStock(ctx, payload, orderId)

    if (freshOrder.stripeRefundId && freshOrder.stripeRefundId !== refundId) {
      // Já tem outro refund — não sobrepor
    }

    const now = new Date().toISOString()

    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        paymentStatus: 'refunded',
        orderStatus: 'cancelled',
        stripeRefundId: refundId,
        refundReason,
        cancelledAt: now,
      } as any,
      req: ctx.req,
      overrideAccess: true,
    })

    // ─── Enqueue order_cancelled email notification (mesma transacção) ──
    // Falha ao persistir a notification faz rollback da transacção de domínio.
    const customer = (freshOrder.customer || {}) as any
    await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: orderId,
      recipientEmail: customer.email || freshOrder.email || '',
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
): Promise<boolean> {
  const reservations = await payload.find({
    collection: 'stock-reservations' as any,
    where: {
      order: { equals: orderId },
      status: { equals: 'active' },
    },
    limit: 100,
    depth: 0,
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
): Promise<boolean> {
  const items = await payload.find({
    collection: 'stock-reservations' as any,
    where: {
      order: { equals: orderId },
      status: { equals: 'confirmed' },
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const confirmedReservations = items.docs as any[]
  if (confirmedReservations.length === 0) return false

  for (const reservation of confirmedReservations) {
    const flowerId = typeof reservation.flower === 'object'
      ? reservation.flower.id
      : reservation.flower

    // Lock da flower
    await lockFlowerForUpdate(ctx, flowerId)

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

    // made_to_order: não tem stock físico para restaurar
    if (mode === 'made_to_order') continue

    const qty = reservation.quantity ?? 1

    if (mode === 'unique') {
      // Unique: stock era 0 (ou vendido), restaurar para 1, disponível
      await updateFlowerStock(ctx, flowerId, {
        stockQuantity: 1,
        availability: 'available',
      })
    } else if (mode === 'reproducible') {
      // Reproducible: incrementar stock pela quantidade confirmada
      const currentStock = flower.stockQuantity ?? 0
      await updateFlowerStock(ctx, flowerId, {
        stockQuantity: currentStock + qty,
      })
    }

    // Marcar reserva como released (não pode ser re-restaurada)
    await payload.update({
      collection: 'stock-reservations' as any,
      id: reservation.id,
      data: { status: 'released', releasedAt: new Date().toISOString() } as any,
      req: ctx.req,
      overrideAccess: true,
    })
  }

  return true
}