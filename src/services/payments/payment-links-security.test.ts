import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createPaymentForOrder: vi.fn(),
  lockOrderForUpdate: vi.fn(),
  runInTransactionWithRetry: vi.fn(),
}))

vi.mock('./payments', () => ({
  createPaymentForOrder: mocks.createPaymentForOrder,
}))

vi.mock('../db-adapter', () => ({
  lockOrderForUpdate: mocks.lockOrderForUpdate,
}))

vi.mock('../transact', () => ({
  runInTransactionWithRetry: mocks.runInTransactionWithRetry,
}))

import {
  createPaymentSessionFromLink,
  hashPaymentLinkToken,
  issueManualPaymentLink,
  PaymentLinkError,
} from './payment-links'

const NOW = new Date('2030-01-01T00:00:00.000Z')

let order: any
let reservations: any[]

function baseOrder(overrides: Record<string, any> = {}) {
  return {
    id: 42,
    orderNumber: 'EF-20300101-MANUAL',
    orderSource: 'manual',
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentProvider: null,
    checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
    stripePaymentIntentId: null,
    paymentLinkTokenHash: null,
    paymentLinkExpiresAt: null,
    currency: 'EUR',
    subtotal: 100,
    discount: 0,
    shippingCost: 8,
    total: 108,
    items: [{
      flower: 1,
      name: 'Rosa',
      price: 50,
      qty: 2,
      lineTotal: 100,
      productionMode: 'reproducible',
    }],
    ...overrides,
  }
}

function createPayload() {
  return {
    findByID: vi.fn(async ({ collection, id }: any) => (
      collection === 'orders' && Number(id) === order.id ? order : null
    )),
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'orders') {
        const requestedHash = where?.paymentLinkTokenHash?.equals
        const docs = requestedHash && requestedHash === order.paymentLinkTokenHash ? [order] : []
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'stock-reservations') {
        const docs = reservations.filter((reservation) => Number(reservation.order) === Number(where.order.equals))
        return { docs, totalDocs: docs.length }
      }
      return { docs: [], totalDocs: 0 }
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection !== 'orders' || Number(id) !== order.id) throw new Error('Unexpected update')
      order = { ...order, ...data }
      return order
    }),
  } as any
}

describe('secure manual Stripe payment links', () => {
  beforeEach(() => {
    order = baseOrder()
    reservations = [{
      id: 7,
      order: 42,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: '2030-01-01T02:00:00.000Z',
    }]
    vi.clearAllMocks()
    mocks.runInTransactionWithRetry.mockImplementation(async (payload, req, fn) => (
      fn({ req: req || { payload }, ownsTransaction: false })
    ))
    mocks.createPaymentForOrder.mockResolvedValue({
      kind: 'created',
      paymentIntentId: 'pi_server_derived',
      clientSecret: 'pi_server_derived_secret',
    })
  })

  it('K: issues a high-entropy opaque token but persists only its SHA-256 hash', async () => {
    const payload = createPayload()
    const issued = await issueManualPaymentLink(payload, {
      orderId: 42,
      issuedBy: 9,
      now: NOW,
    })

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(order.paymentLinkTokenHash).toBe(hashPaymentLinkToken(issued.token))
    expect(order.paymentLinkTokenHash).not.toContain(issued.token)
    expect(JSON.stringify(payload.update.mock.calls)).not.toContain(issued.token)
    expect(order).toMatchObject({
      paymentProvider: 'stripe',
      paymentLinkIssuedAt: NOW.toISOString(),
      paymentLinkIssuedBy: 9,
      paymentLinkConsumedAt: null,
    })
  })

  it('K: caps link lifetime at the earliest stock-reservation expiry', async () => {
    const payload = createPayload()
    reservations.push({
      id: 8,
      order: 42,
      flower: 1,
      quantity: 0,
      status: 'active',
      expiresAt: '2030-01-01T04:00:00.000Z',
    })

    const issued = await issueManualPaymentLink(payload, {
      orderId: 42,
      issuedBy: 9,
      now: NOW,
      ttlMs: 24 * 60 * 60 * 1000,
    })

    expect(issued.expiresAt).toBe('2030-01-01T02:00:00.000Z')
  })

  it('L: resolves the order by token hash and asks Stripe to use only the stored order id', async () => {
    const payload = createPayload()
    const issued = await issueManualPaymentLink(payload, {
      orderId: 42,
      issuedBy: 9,
      now: NOW,
    })

    const result = await createPaymentSessionFromLink(payload, issued.token, NOW)

    expect(result).toEqual({ clientSecret: 'pi_server_derived_secret' })
    expect(mocks.createPaymentForOrder).toHaveBeenCalledTimes(1)
    expect(mocks.createPaymentForOrder).toHaveBeenCalledWith(payload, { orderId: 42 })
    const paymentInput = mocks.createPaymentForOrder.mock.calls[0][1]
    expect(paymentInput).not.toHaveProperty('amount')
    expect(paymentInput).not.toHaveProperty('currency')
    expect(paymentInput).not.toHaveProperty('total')
  })

  it('K: an expired link fails before any PaymentIntent is created', async () => {
    const payload = createPayload()
    const issued = await issueManualPaymentLink(payload, {
      orderId: 42,
      issuedBy: 9,
      now: NOW,
    })

    await expect(createPaymentSessionFromLink(
      payload,
      issued.token,
      new Date('2030-01-01T02:00:00.001Z'),
    )).rejects.toMatchObject({ code: 'PAYMENT_LINK_EXPIRED' })
    expect(mocks.createPaymentForOrder).not.toHaveBeenCalled()
  })

  it('K: rotating a link invalidates the previous bearer token', async () => {
    const payload = createPayload()
    const first = await issueManualPaymentLink(payload, { orderId: 42, issuedBy: 9, now: NOW })
    const second = await issueManualPaymentLink(payload, { orderId: 42, issuedBy: 9, now: NOW })

    expect(first.token).not.toBe(second.token)
    await expect(createPaymentSessionFromLink(payload, first.token, NOW))
      .rejects.toMatchObject({ code: 'PAYMENT_LINK_INVALID' })
    await expect(createPaymentSessionFromLink(payload, second.token, NOW))
      .resolves.toEqual({ clientSecret: 'pi_server_derived_secret' })
  })

  it('G/K: refuses to issue a Stripe link while cúpula shipping is unconfirmed', async () => {
    const payload = createPayload()
    order = baseOrder({
      orderStatus: 'awaiting_shipping',
      shippingCost: null,
      total: null,
    })

    await expect(issueManualPaymentLink(payload, {
      orderId: 42,
      issuedBy: 9,
      now: NOW,
    })).rejects.toBeInstanceOf(PaymentLinkError)
    expect(payload.update).not.toHaveBeenCalled()
    expect(mocks.createPaymentForOrder).not.toHaveBeenCalled()
  })

  it('K: fails closed when any required reservation is missing, mismatched, or inactive', async () => {
    const payload = createPayload()
    reservations[0].quantity = 1
    await expect(issueManualPaymentLink(payload, { orderId: 42, issuedBy: 9, now: NOW }))
      .rejects.toMatchObject({ code: 'PAYMENT_LINK_NOT_ALLOWED' })

    reservations[0].quantity = 2
    reservations[0].status = 'released'
    await expect(issueManualPaymentLink(payload, { orderId: 42, issuedBy: 9, now: NOW }))
      .rejects.toMatchObject({ code: 'PAYMENT_LINK_EXPIRED' })
    expect(payload.update).not.toHaveBeenCalled()
  })
})
