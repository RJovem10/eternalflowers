import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  lockOrderForUpdate: vi.fn(),
  runInTransactionWithRetry: vi.fn(),
  validateActiveOrderReservations: vi.fn(),
}))

vi.mock('./db-adapter', () => ({
  lockOrderForUpdate: mocks.lockOrderForUpdate,
}))

vi.mock('./transact', () => ({
  runInTransactionWithRetry: mocks.runInTransactionWithRetry,
}))

vi.mock('./payments/payment-links', () => ({
  validateActiveOrderReservations: mocks.validateActiveOrderReservations,
}))

import {
  confirmCupulaShippingQuote,
  CupulaShippingConfirmationError,
} from './cupula-shipping'

let order: any

function createPayload() {
  return {
    findByID: vi.fn(async ({ collection, id }: any) => (
      collection === 'orders' && Number(id) === order.id ? order : null
    )),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection !== 'orders' || Number(id) !== order.id) throw new Error('Unexpected update')
      order = { ...order, ...data }
      return order
    }),
  } as any
}

describe('manual cúpula shipping confirmation', () => {
  beforeEach(() => {
    order = {
      id: 42,
      orderSource: 'manual',
      orderStatus: 'awaiting_shipping',
      paymentStatus: 'unpaid',
      paymentProvider: null,
      stripePaymentIntentId: null,
      subtotal: 120,
      discount: 10,
      shippingCost: null,
      total: null,
      shippingConfirmedAt: null,
      items: [{ flower: 3, qty: 1, productionMode: 'reproducible' }],
    }
    vi.clearAllMocks()
    mocks.runInTransactionWithRetry.mockImplementation(async (payload, req, fn) => (
      fn({ req: req || { payload }, ownsTransaction: false })
    ))
    mocks.validateActiveOrderReservations.mockResolvedValue(new Date(Date.now() + 60_000))
  })

  it('G: requires explicit administrator confirmation before accepting a quote', async () => {
    const payload = createPayload()
    await expect(confirmCupulaShippingQuote(payload, {
      orderId: 42,
      quoteAmountCents: 1234,
      confirmed: false,
      confirmedBy: 9,
    })).rejects.toThrow(/confirmação explícita/i)
    expect(payload.update).not.toHaveBeenCalled()
    expect(mocks.validateActiveOrderReservations).not.toHaveBeenCalled()
  })

  it('G/L: calculates the final total from stored subtotal/discount plus integer quote cents', async () => {
    const payload = createPayload()
    const result = await confirmCupulaShippingQuote(payload, {
      orderId: 42,
      quoteAmountCents: 1234,
      reference: '  CTT-Q-123  ',
      confirmed: true,
      confirmedBy: 9,
      // Browser-supplied financial/status values are intentionally ignored.
      subtotal: 0,
      discount: 999,
      total: 0.01,
      paymentStatus: 'paid',
    } as any)

    expect(result.kind).toBe('confirmed')
    expect(mocks.validateActiveOrderReservations).toHaveBeenCalledTimes(1)
    expect(order).toMatchObject({
      subtotal: 120,
      discount: 10,
      shippingCost: 12.34,
      total: 122.34,
      shippingProvider: 'manual_quote',
      shippingServiceCode: 'CUPULA_CONFIRMED',
      shippingQuoteReference: 'CTT-Q-123',
      shippingConfirmedBy: 9,
      orderStatus: 'pending_payment',
      paymentStatus: 'unpaid',
    })
    expect(order.shippingConfirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('is idempotent for identical quote evidence and conflicts for different data', async () => {
    const payload = createPayload()
    const input = {
      orderId: 42,
      quoteAmountCents: 1234,
      reference: 'QUOTE-1',
      confirmed: true,
      confirmedBy: 9,
    }

    await expect(confirmCupulaShippingQuote(payload, input))
      .resolves.toMatchObject({ kind: 'confirmed' })
    await expect(confirmCupulaShippingQuote(payload, input))
      .resolves.toMatchObject({ kind: 'already_confirmed' })
    expect(payload.update).toHaveBeenCalledTimes(1)

    await expect(confirmCupulaShippingQuote(payload, {
      ...input,
      quoteAmountCents: 999,
    })).rejects.toBeInstanceOf(CupulaShippingConfirmationError)
    expect(payload.update).toHaveBeenCalledTimes(1)
  })

  it('fails closed if reservations are no longer valid', async () => {
    const payload = createPayload()
    mocks.validateActiveOrderReservations.mockRejectedValue(new Error('expired reservation'))

    await expect(confirmCupulaShippingQuote(payload, {
      orderId: 42,
      quoteAmountCents: 500,
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow('expired reservation')
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('never changes a quote after a Stripe PaymentIntent exists', async () => {
    const payload = createPayload()
    order.stripePaymentIntentId = 'pi_already_created'

    await expect(confirmCupulaShippingQuote(payload, {
      orderId: 42,
      quoteAmountCents: 500,
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow(/pagamento Stripe associado/i)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it.each([-1, 100_001, 1.5])('rejects unsafe quote amount in cents: %s', async (quoteAmountCents) => {
    const payload = createPayload()
    await expect(confirmCupulaShippingQuote(payload, {
      orderId: 42,
      quoteAmountCents,
      confirmed: true,
      confirmedBy: 9,
    })).rejects.toThrow(/portes inválido/i)
    expect(payload.update).not.toHaveBeenCalled()
  })
})
