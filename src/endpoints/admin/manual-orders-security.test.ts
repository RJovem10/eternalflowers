import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  canAccessAdmin: vi.fn(),
  confirmCupulaShippingQuote: vi.fn(),
  confirmExternalPayment: vi.fn(),
  createManualOrder: vi.fn(),
  issueManualPaymentLink: vi.fn(),
  prepareOrderForPayment: vi.fn(),
  previewManualOrder: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  canAccessAdmin: mocks.canAccessAdmin,
}))

vi.mock('@/services/orders', () => ({
  createManualOrder: mocks.createManualOrder,
  previewManualOrder: mocks.previewManualOrder,
}))

vi.mock('@/services/checkout-finalization', () => ({
  prepareOrderForPayment: mocks.prepareOrderForPayment,
}))

vi.mock('@/services/payments/manual-payments', () => ({
  confirmExternalPayment: mocks.confirmExternalPayment,
}))

vi.mock('@/services/payments/payment-settlement', () => {
  class PaymentSettlementConflictError extends Error {
    code = 'PAYMENT_SETTLEMENT_CONFLICT'
  }
  class SettlementStockUnavailableError extends Error {
    code = 'SETTLEMENT_STOCK_UNAVAILABLE'
  }
  return {
    EXTERNAL_PAYMENT_METHODS: ['external_mb_way', 'bank_transfer', 'cash', 'other'],
    PaymentSettlementConflictError,
    SettlementStockUnavailableError,
  }
})

vi.mock('@/services/payments/payment-links', () => {
  class PaymentLinkError extends Error {
    code = 'PAYMENT_LINK_NOT_ALLOWED'
  }
  return {
    issueManualPaymentLink: mocks.issueManualPaymentLink,
    PaymentLinkError,
  }
})

vi.mock('@/services/cupula-shipping', () => {
  class CupulaShippingConfirmationError extends Error {
    code = 'CUPULA_SHIPPING_CONFIRMATION_ERROR'
  }
  return {
    confirmCupulaShippingQuote: mocks.confirmCupulaShippingQuote,
    CupulaShippingConfirmationError,
  }
})

const {
  confirmManualPaymentHandler,
  confirmShippingHandler,
  createManualOrderHandler,
  issuePaymentLinkHandler,
  previewManualOrderHandler,
} = await import('./manual-orders')

const validBody = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  salesChannel: 'whatsapp',
  customer: { name: 'Maria', phone: '+351 912 345 678' },
  shippingAddress: {
    recipientName: 'Maria',
    line1: 'Rua das Flores, 1',
    city: 'Lisboa',
    postalCode: '1000-001',
    country: 'PT',
  },
  billingSameAsShipping: true,
  items: [{ flowerId: 1, qty: 2 }],
  locale: 'pt',
}

function makeRequest({
  user = { id: 9, collection: 'users' },
  body = validBody,
  routeID = '42',
}: {
  user?: any
  body?: any
  routeID?: string
} = {}) {
  const payload = {
    config: { serverURL: 'https://shop.example.test' },
    findByID: vi.fn(async () => ({
      id: 42,
      orderNumber: 'EF-MANUAL-42',
      locale: 'pt',
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      subtotal: 51,
      discount: 0,
      shippingCost: 8,
      total: 59,
    })),
  }
  return {
    payload,
    user,
    routeParams: { id: routeID },
    url: 'https://shop.example.test/api/orders/manual/preview',
    json: vi.fn(async () => body),
  } as any
}

describe('manual-order admin endpoint security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canAccessAdmin.mockResolvedValue(undefined)
    mocks.previewManualOrder.mockResolvedValue({
      items: [], subtotal: 51, discount: 0, shippingCost: 8, total: 59,
      orderStatus: 'pending_payment',
    })
    mocks.createManualOrder.mockResolvedValue({
      order: {
        id: 42,
        orderNumber: 'EF-MANUAL-42',
        locale: 'pt',
        orderStatus: 'draft',
        paymentStatus: 'unpaid',
        subtotal: 51,
        discount: 0,
        shippingCost: null,
        total: null,
      },
    })
    mocks.prepareOrderForPayment.mockResolvedValue({
      kind: 'prepared',
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440001',
      order: {
        id: 42,
        orderNumber: 'EF-MANUAL-42',
        locale: 'pt',
        orderStatus: 'pending_payment',
        paymentStatus: 'unpaid',
        subtotal: 51,
        discount: 0,
        shippingCost: 8,
        total: 59,
      },
    })
    mocks.confirmExternalPayment.mockResolvedValue({ kind: 'processed', orderId: 42 })
    mocks.issueManualPaymentLink.mockResolvedValue({
      token: 'opaque-token-value',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    mocks.confirmCupulaShippingQuote.mockResolvedValue({ kind: 'confirmed', order: {} })
  })

  const handlers = [
    ['preview', previewManualOrderHandler],
    ['create', createManualOrderHandler],
    ['manual payment', confirmManualPaymentHandler],
    ['payment link', issuePaymentLinkHandler],
    ['shipping quote', confirmShippingHandler],
  ] as const

  it.each(handlers)('P: %s endpoint rejects unauthenticated callers before domain work', async (_name, handler) => {
    const response = await handler(makeRequest({ user: null }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ ok: false })
    expect(mocks.canAccessAdmin).not.toHaveBeenCalled()
    expect(mocks.previewManualOrder).not.toHaveBeenCalled()
    expect(mocks.createManualOrder).not.toHaveBeenCalled()
    expect(mocks.confirmExternalPayment).not.toHaveBeenCalled()
    expect(mocks.issueManualPaymentLink).not.toHaveBeenCalled()
    expect(mocks.confirmCupulaShippingQuote).not.toHaveBeenCalled()
  })

  it.each(handlers)('P: %s endpoint rejects authenticated users without admin access', async (_name, handler) => {
    mocks.canAccessAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const response = await handler(makeRequest())
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ ok: false })
    expect(mocks.previewManualOrder).not.toHaveBeenCalled()
    expect(mocks.createManualOrder).not.toHaveBeenCalled()
    expect(mocks.confirmExternalPayment).not.toHaveBeenCalled()
    expect(mocks.issueManualPaymentLink).not.toHaveBeenCalled()
    expect(mocks.confirmCupulaShippingQuote).not.toHaveBeenCalled()
  })

  it('E: preview maps only product identity/quantity and ignores browser financial/status authority', async () => {
    const body = {
      ...validBody,
      items: [{
        flowerId: 1,
        qty: 2,
        price: 0.01,
        lineTotal: 0.02,
        name: 'Forjado',
      }],
      subtotal: 0.02,
      discount: 1000,
      shippingCost: 0,
      total: 0.01,
      orderStatus: 'completed',
      paymentStatus: 'paid',
      paymentProvider: 'manual',
    }
    const request = makeRequest({ body })

    const response = await previewManualOrderHandler(request)
    expect(response.status).toBe(200)
    expect(mocks.previewManualOrder).toHaveBeenCalledTimes(1)
    const mapped = mocks.previewManualOrder.mock.calls[0][1]
    expect(mapped.items).toEqual([{ flowerId: 1, qty: 2 }])
    expect(mapped).not.toHaveProperty('subtotal')
    expect(mapped).not.toHaveProperty('discount')
    expect(mapped).not.toHaveProperty('shippingCost')
    expect(mapped).not.toHaveProperty('total')
    expect(mapped).not.toHaveProperty('orderStatus')
    expect(mapped).not.toHaveProperty('paymentStatus')
    expect(mapped).not.toHaveProperty('paymentProvider')
  })

  it('I/P: external confirmation uses authenticated user id, never a browser-supplied actor or amount', async () => {
    const body = {
      ...validBody,
      paymentChoice: 'external',
      externalPayment: {
        method: 'cash',
        reference: 'CASH-1',
        confirmed: true,
        confirmedBy: 777,
        amount: 0.01,
        total: 0.01,
      },
    }
    const request = makeRequest({ body })

    const response = await createManualOrderHandler(request)
    expect(response.status).toBe(201)
    const confirmation = mocks.confirmExternalPayment.mock.calls[0][1]
    expect(confirmation).toMatchObject({
      orderId: 42,
      method: 'cash',
      reference: 'CASH-1',
      confirmed: true,
      confirmedBy: 9,
    })
    expect(confirmation).not.toHaveProperty('amount')
    expect(confirmation).not.toHaveProperty('total')
    expect(confirmation.confirmedBy).not.toBe(777)
  })

  it('K/P: returns the opaque payment token only in the URL fragment', async () => {
    const response = await issuePaymentLinkHandler(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.paymentLink).toBe('https://shop.example.test/pt/pagar#token=opaque-token-value')
    expect(data.paymentLink.split('#')[0]).not.toContain('opaque-token-value')
    expect(mocks.issueManualPaymentLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: 42, issuedBy: 9 }),
    )
  })
})
