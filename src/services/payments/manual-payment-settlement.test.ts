import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirmReservation: vi.fn(),
  enqueueEmailNotification: vi.fn(),
  lockCouponForUpdate: vi.fn(),
  lockOrderForUpdate: vi.fn(),
  runInTransactionWithRetry: vi.fn(),
}))

vi.mock('../transact', () => ({
  runInTransactionWithRetry: mocks.runInTransactionWithRetry,
}))

vi.mock('../stock', () => ({
  confirmReservation: mocks.confirmReservation,
}))

vi.mock('../db-adapter', () => ({
  lockCouponForUpdate: mocks.lockCouponForUpdate,
  lockOrderForUpdate: mocks.lockOrderForUpdate,
}))

vi.mock('../email/email-notifications', () => ({
  enqueueEmailNotification: mocks.enqueueEmailNotification,
  dedupKeyConfirmed: (orderID: number) => `order:${orderID}:confirmed`,
}))

import { confirmExternalPayment } from './manual-payments'
import {
  PaymentSettlementConflictError,
  settleOrderPayment,
  SettlementStockUnavailableError,
} from './payment-settlement'

let order: any
let reservations: any[]

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: 42,
    orderNumber: 'EF-20260822-MANUAL',
    orderSource: 'manual',
    salesChannel: 'whatsapp',
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentProvider: null,
    paymentMethodType: null,
    stripePaymentIntentId: null,
    manualPaymentReference: null,
    subtotal: 51,
    discount: 0,
    shippingCost: 8,
    total: 59,
    currency: 'EUR',
    customer: { name: 'Maria', email: null },
    email: '',
    locale: 'pt',
    items: [
      { flower: 1, name: 'Rosa', price: 17, qty: 1, lineTotal: 17, productionMode: 'reproducible' },
      { flower: 1, name: 'Rosa', price: 17, qty: 2, lineTotal: 34, productionMode: 'reproducible' },
    ],
    ...overrides,
  }
}

function createPayload() {
  const payload: any = {
    db: { name: 'sqlite' },
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === 'orders' && Number(id) === order.id) return order
      if (collection === 'stock-reservations') {
        return reservations.find((reservation) => reservation.id === Number(id)) || null
      }
      return null
    }),
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'stock-reservations') {
        const docs = reservations.filter((reservation) => Number(reservation.order) === Number(where.order.equals))
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'coupons') return { docs: [], totalDocs: 0 }
      return { docs: [], totalDocs: 0 }
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === 'orders' && Number(id) === order.id) {
        order = { ...order, ...data }
        return order
      }
      if (collection === 'stock-reservations') {
        const index = reservations.findIndex((reservation) => reservation.id === Number(id))
        reservations[index] = { ...reservations[index], ...data }
        return reservations[index]
      }
      throw new Error(`Unexpected update: ${collection}`)
    }),
  }
  return payload
}

describe('manual external-payment settlement', () => {
  beforeEach(() => {
    order = makeOrder()
    reservations = [{
      id: 7,
      order: 42,
      flower: 1,
      quantity: 3,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }]
    vi.clearAllMocks()
    mocks.runInTransactionWithRetry.mockImplementation(async (payload, req, fn) => (
      fn({ req: req || { payload }, ownsTransaction: false })
    ))
    mocks.confirmReservation.mockImplementation(async (_payload, { reservationId }) => {
      const reservation = reservations.find((candidate) => candidate.id === Number(reservationId))
      if (!reservation) throw new Error('missing reservation')
      if (reservation.status === 'confirmed') {
        return { kind: 'already_confirmed', reservationId: reservation.id }
      }
      reservation.status = 'confirmed'
      reservation.confirmedAt = new Date().toISOString()
      return { kind: 'confirmed', reservationId: reservation.id }
    })
  })

  it('I/N: confirms exact aggregated stock once, records manual evidence, and skips email when absent', async () => {
    const payload = createPayload()
    const result = await confirmExternalPayment(payload, {
      orderId: 42,
      method: 'external_mb_way',
      reference: '  MBW-123  ',
      confirmed: true,
      confirmedBy: 9,
      // These untrusted extras must have no authority in settlement.
      amount: 0.01,
      paymentStatus: 'refunded',
      orderStatus: 'completed',
    } as any)

    expect(result).toEqual({ kind: 'processed', orderId: 42 })
    expect(mocks.confirmReservation).toHaveBeenCalledTimes(1)
    expect(mocks.confirmReservation).toHaveBeenCalledWith(payload, expect.objectContaining({ reservationId: 7 }))
    expect(order).toMatchObject({
      total: 59,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      paymentProvider: 'manual',
      paymentMethodType: 'external_mb_way',
      manualPaymentReference: 'MBW-123',
      manualPaymentConfirmedBy: 9,
    })
    expect(order.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(mocks.enqueueEmailNotification).not.toHaveBeenCalled()
  })

  it('J: repeating the same confirmation is idempotent and never confirms stock twice', async () => {
    const payload = createPayload()
    const input = {
      orderId: 42,
      method: 'cash' as const,
      reference: 'POS-001',
      confirmed: true,
      confirmedBy: 9,
    }

    await expect(confirmExternalPayment(payload, input))
      .resolves.toEqual({ kind: 'processed', orderId: 42 })
    await expect(confirmExternalPayment(payload, input))
      .resolves.toEqual({ kind: 'already_processed', orderId: 42 })

    expect(mocks.confirmReservation).toHaveBeenCalledTimes(1)
    const financialUpdates = payload.update.mock.calls.filter(
      ([args]: any[]) => args.collection === 'orders' && args.data.paymentStatus === 'paid',
    )
    expect(financialUpdates).toHaveLength(1)
  })

  it('J: rejects a second confirmation with different evidence', async () => {
    const payload = createPayload()
    await confirmExternalPayment(payload, {
      orderId: 42,
      method: 'cash',
      reference: 'CASH-1',
      confirmed: true,
      confirmedBy: 9,
    })

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'bank_transfer',
      reference: 'BANK-2',
      confirmed: true,
      confirmedBy: 10,
    })).rejects.toThrow(PaymentSettlementConflictError)
    expect(mocks.confirmReservation).toHaveBeenCalledTimes(1)
  })

  it('I: fails closed before stock mutation when reservations do not exactly match order quantities', async () => {
    const payload = createPayload()
    reservations[0].quantity = 2

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'cash',
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow(SettlementStockUnavailableError)

    expect(mocks.confirmReservation).not.toHaveBeenCalled()
    expect(order.paymentStatus).toBe('unpaid')
    expect(order.orderStatus).toBe('pending_payment')
  })

  it('never permits external settlement for an existing website order', async () => {
    const payload = createPayload()
    order.orderSource = 'website'
    order.paymentProvider = 'stripe'

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'bank_transfer',
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow(PaymentSettlementConflictError)
    expect(mocks.confirmReservation).not.toHaveBeenCalled()
  })

  it('fails closed when a Stripe link was already issued, even before a PaymentIntent exists', async () => {
    const payload = createPayload()
    order.paymentProvider = 'stripe'
    order.paymentLinkTokenHash = 'sha256-only-capability'
    order.paymentLinkIssuedAt = new Date().toISOString()

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'bank_transfer',
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow(PaymentSettlementConflictError)

    expect(mocks.confirmReservation).not.toHaveBeenCalled()
    expect(order.paymentStatus).toBe('unpaid')
  })

  it('revalidates after the order lock and loses safely to concurrent Stripe link issuance', async () => {
    const payload = createPayload()
    mocks.lockOrderForUpdate.mockImplementationOnce(async () => {
      order.paymentProvider = 'stripe'
      order.paymentLinkTokenHash = 'issued-by-concurrent-transaction'
      order.paymentLinkIssuedAt = new Date().toISOString()
    })

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'cash',
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow(PaymentSettlementConflictError)

    expect(mocks.lockOrderForUpdate).toHaveBeenCalledWith(expect.anything(), 42)
    expect(mocks.confirmReservation).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation and a server-authenticated administrator identity', async () => {
    const payload = createPayload()

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'cash',
      confirmed: false,
      confirmedBy: 9,
    })).rejects.toThrow(/confirmação explícita/i)

    await expect(confirmExternalPayment(payload, {
      orderId: 42,
      method: 'cash',
      confirmed: true,
      confirmedBy: '',
    })).rejects.toThrow(/administrador/i)
    expect(mocks.confirmReservation).not.toHaveBeenCalled()
  })

  it('N: enqueues the existing confirmation email only when a recipient exists', async () => {
    const payload = createPayload()
    order.customer.email = 'maria@example.com'

    await confirmExternalPayment(payload, {
      orderId: 42,
      method: 'bank_transfer',
      reference: 'TRX-123',
      confirmed: true,
      confirmedBy: 9,
    })

    expect(mocks.enqueueEmailNotification).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueEmailNotification).toHaveBeenCalledWith(payload, expect.objectContaining({
      type: 'order_confirmed',
      orderId: 42,
      recipientEmail: 'maria@example.com',
      deduplicationKey: 'order:42:confirmed',
    }))
  })

  it('M/K: Stripe server settlement consumes the payment-link capability and is idempotent', async () => {
    const payload = createPayload()
    order.paymentProvider = 'stripe'
    order.stripePaymentIntentId = 'pi_link_42'
    order.paymentLinkTokenHash = 'sha256-only-capability'
    order.paymentLinkExpiresAt = new Date(Date.now() + 60_000).toISOString()

    const input = {
      orderId: 42,
      payment: {
        provider: 'stripe' as const,
        paymentIntentId: 'pi_link_42',
        paymentMethodType: 'card',
      },
    }
    await expect(settleOrderPayment(payload, input))
      .resolves.toEqual({ kind: 'processed', orderId: 42 })
    await expect(settleOrderPayment(payload, input))
      .resolves.toEqual({ kind: 'already_processed', orderId: 42 })

    expect(mocks.confirmReservation).toHaveBeenCalledTimes(1)
    expect(order).toMatchObject({
      paymentProvider: 'stripe',
      stripePaymentIntentId: 'pi_link_42',
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      paymentLinkTokenHash: null,
      paymentLinkExpiresAt: null,
    })
    expect(order.paymentLinkConsumedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
