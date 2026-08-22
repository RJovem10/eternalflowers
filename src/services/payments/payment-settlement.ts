import type { Payload } from 'payload'
import { runInTransactionWithRetry, type TransactionCtx } from '../transact'
import { confirmReservation } from '../stock'
import { lockCouponForUpdate, lockOrderForUpdate } from '../db-adapter'
import { enqueueEmailNotification, dedupKeyConfirmed } from '../email/email-notifications'

const FORWARD_PAID_STATUSES = new Set(['confirmed', 'processing', 'shipped', 'completed'])

export const EXTERNAL_PAYMENT_METHODS = [
  'external_mb_way',
  'bank_transfer',
  'cash',
  'other',
] as const

export type ExternalPaymentMethod = (typeof EXTERNAL_PAYMENT_METHODS)[number]

export type SettlementPayment =
  | {
      provider: 'stripe'
      paymentIntentId: string
      paymentMethodType: string | null
    }
  | {
      provider: 'manual'
      paymentMethodType: ExternalPaymentMethod
      reference?: string
      confirmedBy?: number | string
    }

export interface SettleOrderPaymentInput {
  orderId: number
  payment: SettlementPayment
  req?: any
}

export type SettleOrderPaymentResult =
  | { kind: 'processed'; orderId: number }
  | { kind: 'already_processed'; orderId: number }

export class PaymentSettlementError extends Error {
  code: string = 'PAYMENT_SETTLEMENT_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'PaymentSettlementError'
  }
}

export class PaymentSettlementConflictError extends PaymentSettlementError {
  code = 'PAYMENT_SETTLEMENT_CONFLICT' as const
  constructor(message: string) {
    super(message)
    this.name = 'PaymentSettlementConflictError'
  }
}

export class SettlementStockUnavailableError extends PaymentSettlementError {
  code = 'SETTLEMENT_STOCK_UNAVAILABLE' as const
  constructor(message: string) {
    super(message)
    this.name = 'SettlementStockUnavailableError'
  }
}

/**
 * Liquidação de pagamento partilhada por Stripe e pagamentos externos.
 * Toda a alteração de stock, cupão, Order e outbox ocorre na mesma transação.
 */
export async function settleOrderPayment(
  payload: Payload,
  input: SettleOrderPaymentInput,
): Promise<SettleOrderPaymentResult> {
  return runInTransactionWithRetry(payload, input.req, async (ctx) => {
    await lockOrderForUpdate(ctx, input.orderId)

    const order = await payload.findByID({
      collection: 'orders',
      id: input.orderId,
      depth: 0,
      req: ctx.req,
      overrideAccess: true,
    }) as any

    if (!order?.id) {
      throw new PaymentSettlementError(`Order ${input.orderId} não encontrada.`)
    }

    validateSettlementState(order, input.payment)

    if (order.paymentStatus === 'paid' && FORWARD_PAID_STATUSES.has(order.orderStatus)) {
      return { kind: 'already_processed', orderId: order.id }
    }

    const reservations = await loadOrderReservations(payload, order.id, ctx.req)
    await confirmExactReservations(ctx, payload, order, reservations)
    const now = new Date().toISOString()
    const couponRedeemed = await redeemCouponIfNeeded(ctx, payload, order)

    const updateData: Record<string, unknown> = {
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      paymentProvider: input.payment.provider,
      paymentMethodType: input.payment.paymentMethodType,
      paidAt: now,
    }

    if (couponRedeemed) updateData.couponRedeemedAt = now
    if (order.paymentLinkTokenHash) {
      updateData.paymentLinkTokenHash = null
      updateData.paymentLinkExpiresAt = null
      updateData.paymentLinkConsumedAt = now
    }

    if (input.payment.provider === 'stripe') {
      updateData.stripePaymentIntentId = input.payment.paymentIntentId
    } else {
      updateData.manualPaymentReference = input.payment.reference?.trim() || null
      updateData.manualPaymentConfirmedBy = input.payment.confirmedBy || null
    }

    await payload.update({
      collection: 'orders',
      id: order.id,
      data: updateData as any,
      req: ctx.req,
      overrideAccess: true,
    })

    const recipientEmail = String(order.customer?.email || order.email || '').trim()
    if (recipientEmail) {
      const items = (order.items as any[]) || []
      await enqueueEmailNotification(payload, {
        type: 'order_confirmed',
        orderId: order.id,
        recipientEmail,
        locale: order.locale || 'pt',
        deduplicationKey: dedupKeyConfirmed(order.id),
        snapshot: {
          type: 'order_confirmed',
          data: {
            orderNumber: order.orderNumber || String(order.id),
            customerName: order.customer?.name || '',
            items: items.map((item: any) => ({
              name: item.name || '',
              qty: Number(item.qty) || 1,
              unitPrice: Number(item.price) || 0,
              lineTotal: Number(item.lineTotal) || 0,
            })),
            subtotal: Number(order.subtotal) || 0,
            discount: Number(order.discount) || 0,
            shippingCost: Number(order.shippingCost) || 0,
            total: Number(order.total) || 0,
            currency: order.currency || 'EUR',
          },
        },
        req: ctx.req,
      })
    }

    return { kind: 'processed', orderId: order.id }
  })
}

function validateSettlementState(order: any, payment: SettlementPayment): void {
  if (order.paymentStatus === 'paid') {
    const sameProvider = (order.paymentProvider || 'stripe') === payment.provider
    const sameIntent = payment.provider !== 'stripe' || order.stripePaymentIntentId === payment.paymentIntentId
    const sameManualEvidence = payment.provider !== 'manual' || (
      order.paymentMethodType === payment.paymentMethodType &&
      String(order.manualPaymentReference || '').trim() === String(payment.reference || '').trim()
    )
    if (
      sameProvider &&
      sameIntent &&
      sameManualEvidence &&
      FORWARD_PAID_STATUSES.has(order.orderStatus)
    ) return
    throw new PaymentSettlementConflictError('A encomenda já foi paga por outra origem.')
  }

  if (order.orderStatus !== 'pending_payment') {
    throw new PaymentSettlementConflictError(
      `Order ${order.id} está "${order.orderStatus}"; apenas pending_payment pode ser liquidada.`,
    )
  }
  if (Number(order.total) <= 0) {
    throw new PaymentSettlementConflictError('A encomenda não tem um total final válido.')
  }

  if (payment.provider === 'manual') {
    if (order.orderSource !== 'manual') {
      throw new PaymentSettlementConflictError('Pagamento externo só é permitido em encomendas manuais.')
    }
    if (
      order.stripePaymentIntentId ||
      order.paymentProvider === 'stripe' ||
      order.paymentLinkTokenHash ||
      order.paymentLinkIssuedAt
    ) {
      throw new PaymentSettlementConflictError(
        'A encomenda já foi associada a um fluxo Stripe e não aceita confirmação externa.',
      )
    }
    if (order.paymentProvider && order.paymentProvider !== 'manual') {
      throw new PaymentSettlementConflictError('A encomenda está associada a outro provider de pagamento.')
    }
    if (!['unpaid', 'failed'].includes(order.paymentStatus)) {
      throw new PaymentSettlementConflictError(`Estado de pagamento inválido: ${order.paymentStatus}.`)
    }
    if (!EXTERNAL_PAYMENT_METHODS.includes(payment.paymentMethodType)) {
      throw new PaymentSettlementConflictError('Método de pagamento externo inválido.')
    }
    return
  }

  if (order.paymentProvider && order.paymentProvider !== 'stripe') {
    throw new PaymentSettlementConflictError('A encomenda está associada a pagamento externo.')
  }
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== payment.paymentIntentId) {
    throw new PaymentSettlementConflictError('PaymentIntent não corresponde à encomenda.')
  }
  if (!['unpaid', 'failed', 'pending'].includes(order.paymentStatus)) {
    throw new PaymentSettlementConflictError(`Estado de pagamento inválido: ${order.paymentStatus}.`)
  }
}

async function loadOrderReservations(payload: Payload, orderId: number, req: any): Promise<any[]> {
  const docs: any[] = []
  const limit = 100
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'stock-reservations' as any,
      where: { order: { equals: orderId } },
      limit,
      page,
      depth: 0,
      req,
      overrideAccess: true,
    })
    docs.push(...(result.docs as any[]))
    if (result.docs.length < limit) break
    page++
  }
  return docs
}

function relationId(value: any): number {
  return Number(typeof value === 'object' ? value?.id : value)
}

async function confirmExactReservations(
  ctx: TransactionCtx,
  payload: Payload,
  order: any,
  reservations: any[],
): Promise<void> {
  const expected = new Map<number, number>()
  for (const item of (order.items as any[]) || []) {
    if (item.productionMode === 'made_to_order') continue
    const flowerId = relationId(item.flower)
    expected.set(flowerId, (expected.get(flowerId) || 0) + (Number(item.qty) || 0))
  }

  const actual = new Map<number, number>()
  for (const reservation of reservations) {
    const flowerId = relationId(reservation.flower)
    actual.set(flowerId, (actual.get(flowerId) || 0) + (Number(reservation.quantity) || 0))
  }

  if (expected.size !== actual.size) {
    throw new SettlementStockUnavailableError('As reservas não correspondem aos artigos da encomenda.')
  }
  for (const [flowerId, qty] of expected) {
    if (qty < 1 || actual.get(flowerId) !== qty) {
      throw new SettlementStockUnavailableError(
        `Quantidade reservada inválida para flowerId=${flowerId}.`,
      )
    }
  }

  const orderedReservations = [...reservations].sort((a, b) => {
    const flowerDiff = relationId(a.flower) - relationId(b.flower)
    return flowerDiff || Number(a.id) - Number(b.id)
  })

  for (const reservation of orderedReservations) {
    let result
    try {
      result = await confirmReservation(payload, {
        reservationId: Number(reservation.id),
        req: ctx.req,
      })
    } catch (error: any) {
      throw new SettlementStockUnavailableError(
        `Falha ao confirmar reserva ${reservation.id}: ${error?.message || 'erro desconhecido'}`,
      )
    }

    if (result.kind === 'confirmed' || result.kind === 'already_confirmed') continue
    throw new SettlementStockUnavailableError(
      `Reserva ${reservation.id} já não está disponível para confirmação.`,
    )
  }
}

async function redeemCouponIfNeeded(
  ctx: TransactionCtx,
  payload: Payload,
  order: any,
): Promise<boolean> {
  const couponCode = String(order.coupon || '').trim()
  if (!couponCode || order.couponRedeemedAt) return false

  const result = await payload.find({
    collection: 'coupons',
    where: { code: { equals: couponCode } },
    limit: 1,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  })
  const coupon = result.docs[0] as any
  if (!coupon?.id) return false

  await lockCouponForUpdate(ctx, coupon.id)
  const freshCoupon = await payload.findByID({
    collection: 'coupons',
    id: coupon.id,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  }) as any
  if (!freshCoupon) return false

  await payload.update({
    collection: 'coupons',
    id: coupon.id,
    data: { usesCount: (Number(freshCoupon.usesCount) || 0) + 1 } as any,
    req: ctx.req,
    overrideAccess: true,
  })
  return true
}
