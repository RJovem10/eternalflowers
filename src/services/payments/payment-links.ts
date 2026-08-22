import crypto from 'crypto'
import type { Payload } from 'payload'
import { createPaymentForOrder } from './payments'
import { lockOrderForUpdate } from '../db-adapter'
import { runInTransactionWithRetry } from '../transact'

const DEFAULT_LINK_TTL_MS = 24 * 60 * 60 * 1000

export class PaymentLinkError extends Error {
  code: 'PAYMENT_LINK_INVALID' | 'PAYMENT_LINK_NOT_ALLOWED' | 'PAYMENT_LINK_EXPIRED'
  constructor(
    code: PaymentLinkError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'PaymentLinkError'
    this.code = code
  }
}

export interface IssuePaymentLinkInput {
  orderId: number
  issuedBy: number | string
  req?: any
  now?: Date
  ttlMs?: number
}

export interface IssuePaymentLinkResult {
  token: string
  expiresAt: string
}

export function hashPaymentLinkToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function issueManualPaymentLink(
  payload: Payload,
  input: IssuePaymentLinkInput,
): Promise<IssuePaymentLinkResult> {
  const now = input.now ?? new Date()
  const configuredTTL = input.ttlMs ?? DEFAULT_LINK_TTL_MS
  if (!Number.isFinite(configuredTTL) || configuredTTL <= 0 || configuredTTL > DEFAULT_LINK_TTL_MS) {
    throw new PaymentLinkError('PAYMENT_LINK_NOT_ALLOWED', 'Prazo do link de pagamento inválido.')
  }

  return runInTransactionWithRetry(payload, input.req, async (ctx) => {
    await lockOrderForUpdate(ctx, input.orderId)
    const order = await payload.findByID({
      collection: 'orders',
      id: input.orderId,
      depth: 0,
      req: ctx.req,
      overrideAccess: true,
    }) as any

    validateOrderForLink(order)

    const reservationExpiry = await validateActiveOrderReservations(payload, order, now, ctx.req)
    const capExpiry = now.getTime() + configuredTTL
    const expiresAtMs = reservationExpiry
      ? Math.min(capExpiry, reservationExpiry.getTime())
      : capExpiry

    if (expiresAtMs <= now.getTime()) {
      throw new PaymentLinkError('PAYMENT_LINK_EXPIRED', 'As reservas desta encomenda já expiraram.')
    }

    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(expiresAtMs).toISOString()
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        paymentProvider: 'stripe',
        paymentLinkTokenHash: hashPaymentLinkToken(token),
        paymentLinkIssuedAt: now.toISOString(),
        paymentLinkExpiresAt: expiresAt,
        paymentLinkConsumedAt: null,
        paymentLinkIssuedBy: input.issuedBy,
      } as any,
      req: ctx.req,
      overrideAccess: true,
    })

    return { token, expiresAt }
  })
}

export async function createPaymentSessionFromLink(
  payload: Payload,
  token: string,
  now = new Date(),
): Promise<{ clientSecret: string | null }> {
  if (!token || token.length < 40 || token.length > 128) {
    throw new PaymentLinkError('PAYMENT_LINK_INVALID', 'Link de pagamento inválido.')
  }

  const result = await payload.find({
    collection: 'orders',
    where: { paymentLinkTokenHash: { equals: hashPaymentLinkToken(token) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const order = result.docs[0] as any
  if (!order?.id) {
    throw new PaymentLinkError('PAYMENT_LINK_INVALID', 'Link de pagamento inválido.')
  }

  validateOrderForLink(order)
  if (!order.paymentLinkExpiresAt || new Date(order.paymentLinkExpiresAt) <= now) {
    throw new PaymentLinkError('PAYMENT_LINK_EXPIRED', 'Este link de pagamento expirou.')
  }
  await validateActiveOrderReservations(payload, order, now)

  const outcome = await createPaymentForOrder(payload, {
    orderId: Number(order.id),
  })
  return { clientSecret: outcome.clientSecret }
}

function validateOrderForLink(order: any): void {
  if (!order?.id || order.orderSource !== 'manual') {
    throw new PaymentLinkError('PAYMENT_LINK_INVALID', 'Link de pagamento inválido.')
  }
  if (order.orderStatus !== 'pending_payment' || !['unpaid', 'failed'].includes(order.paymentStatus)) {
    throw new PaymentLinkError(
      'PAYMENT_LINK_NOT_ALLOWED',
      'Esta encomenda não está disponível para pagamento.',
    )
  }
  if (order.paymentProvider && order.paymentProvider !== 'stripe') {
    throw new PaymentLinkError('PAYMENT_LINK_NOT_ALLOWED', 'A encomenda usa outro método de pagamento.')
  }
  if (Number(order.total) <= 0 || (order.currency || 'EUR') !== 'EUR') {
    throw new PaymentLinkError('PAYMENT_LINK_NOT_ALLOWED', 'A encomenda ainda não tem total final.')
  }
}

export async function validateActiveOrderReservations(
  payload: Payload,
  order: any,
  now: Date,
  req?: any,
): Promise<Date | null> {
  const expected = new Map<number, number>()
  for (const item of (order.items as any[]) || []) {
    if (item.productionMode === 'made_to_order') continue
    const flowerId = Number(typeof item.flower === 'object' ? item.flower?.id : item.flower)
    expected.set(flowerId, (expected.get(flowerId) || 0) + (Number(item.qty) || 0))
  }
  if (expected.size === 0) return null

  const reservations: any[] = []
  const limit = 100
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'stock-reservations' as any,
      where: { order: { equals: order.id } },
      limit,
      page,
      depth: 0,
      req,
      overrideAccess: true,
    })
    reservations.push(...(result.docs as any[]))
    if (result.docs.length < limit) break
    page++
  }

  const actual = new Map<number, number>()
  let earliest: Date | null = null
  for (const reservation of reservations) {
    if (reservation.status !== 'active') {
      throw new PaymentLinkError('PAYMENT_LINK_EXPIRED', 'As reservas desta encomenda já não estão ativas.')
    }
    const expiry = new Date(reservation.expiresAt)
    if (expiry <= now) {
      throw new PaymentLinkError('PAYMENT_LINK_EXPIRED', 'As reservas desta encomenda expiraram.')
    }
    if (!earliest || expiry < earliest) earliest = expiry
    const flowerId = Number(typeof reservation.flower === 'object'
      ? reservation.flower?.id
      : reservation.flower)
    actual.set(flowerId, (actual.get(flowerId) || 0) + (Number(reservation.quantity) || 0))
  }

  if (actual.size !== expected.size) {
    throw new PaymentLinkError('PAYMENT_LINK_NOT_ALLOWED', 'Reservas de stock inconsistentes.')
  }
  for (const [flowerId, qty] of expected) {
    if (actual.get(flowerId) !== qty) {
      throw new PaymentLinkError('PAYMENT_LINK_NOT_ALLOWED', 'Reservas de stock inconsistentes.')
    }
  }
  return earliest
}
