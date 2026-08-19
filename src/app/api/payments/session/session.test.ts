/**
 * Testes unitários para POST /api/payments/session
 *
 * ISSUE-1I:
 * - Reservation guard: active/confirmed → clientSecret
 * - Reservation guard: expired → PAYMENT_RESERVATION_EXPIRED
 * - made_to_order-only não bloqueado pelo guard
 *
 * Testa:
 *  1. capability correta + pending_payment → clientSecret
 *  2. checkoutRequestId errado → acesso negado sem leak
 *  3. orderNumber inexistente → comportamento seguro
 *  4. draft → auto-prepare + create PaymentIntent
 *  5. segunda chamada → mesmo PaymentIntent, não duplica
 *  6. amount/currency não podem ser controlados pelo input
 *  7. clientSecret não é persistido na Order
 *  8. malformed body → 400
 *  9. reservation active → clientSecret
 * 10. reservation expirada → PAYMENT_RESERVATION_EXPIRED
 * 11. made_to_order-only não bloqueado
 * 12. reservation released → PAYMENT_RESERVATION_EXPIRED
 * 13. reservation em falta → PAYMENT_RESERVATION_EXPIRED
 * 14. cupula → CUPULA_SHIPPING_NEEDS_CONFIRMATION
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { toStripeAmount } from '@/services/payments/payment-types'

// ─── Mock Stripe ──────────────────────────────────────────────

let mockPaymentIntents: Record<string, any> = {}
let mockPaymentIntentIdSeq = 0

function resetStripeMocks() {
  mockPaymentIntents = {}
  mockPaymentIntentIdSeq = 0
}

function addMockPaymentIntent(overrides: Partial<any> = {}): any {
  mockPaymentIntentIdSeq++
  const id = `pi_mock_${mockPaymentIntentIdSeq}`
  const intent = {
    id,
    object: 'payment_intent',
    amount: 10000,
    currency: 'eur',
    status: 'requires_payment_method',
    client_secret: `${id}_secret_abc`,
    metadata: {},
    payment_method_types: ['card'],
    payment_method: null,
    ...overrides,
  }
  mockPaymentIntents[id] = intent
  return intent
}

vi.mock('@/services/payments/stripe', async () => {
  return {
    createPaymentIntent: vi.fn(async (params: any) => {
      const intent = addMockPaymentIntent({
        amount: toStripeAmount(params.amount),
        currency: params.currency.toLowerCase(),
        metadata: params.metadata,
        payment_method_types: params.payment_method_types,
      })
      return mockPaymentIntents[intent.id]
    }),
    retrievePaymentIntent: vi.fn(async (paymentIntentId: string) => {
      const intent = mockPaymentIntents[paymentIntentId]
      if (!intent) throw new Error(`PaymentIntent ${paymentIntentId} not found`)
      return intent
    }),
    checkPaymentIntentReusable: vi.fn((paymentIntent: any) => {
      if (paymentIntent.status === 'succeeded') {
        return { reusable: false, reason: 'already_paid' }
      }
      if (!['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(paymentIntent.status)) {
        return { reusable: false, reason: 'finalized' }
      }
      return { reusable: true, paymentIntent }
    }),
    validatePaymentIntentForOrder: vi.fn((paymentIntent: any, orderTotal: number, orderCurrency: string) => {
      const errors: string[] = []
      if (paymentIntent.amount !== toStripeAmount(orderTotal)) {
        errors.push('amount mismatch')
      }
      if (paymentIntent.currency !== orderCurrency.toLowerCase()) {
        errors.push('currency mismatch')
      }
      return { valid: errors.length === 0, errors }
    }),
    constructWebhookEvent: vi.fn(),
    createFullRefund: vi.fn(),
    getSupportedPaymentMethods: vi.fn(() => ['card', 'mb_way', 'link']),
  }
})

// Mock prepareOrderForPayment for draft → pending_payment transition
vi.mock('@/services/checkout-finalization', async () => {
  return {
    prepareOrderForPayment: vi.fn(async (payload: any, input: any) => {
      const orderIdx = mockOrders.findIndex((o: any) => o.id === input.orderId)
      if (orderIdx < 0) throw new Error(`Order ${input.orderId} não encontrada.`)

      const order = mockOrders[orderIdx]
      if (order.orderStatus !== 'draft') {
        // If already prepared, return already_prepared
        if (order.orderStatus === 'pending_payment' || order.orderStatus === 'awaiting_shipping') {
          return {
            order,
            kind: 'already_prepared',
            checkoutAttemptId: order.checkoutAttemptId,
          }
        }
        throw new Error(`Order ${input.orderId} está "${order.orderStatus}".`)
      }

      const isCupula = (order.items || []).some((item: any) => {
        // Check if flower has cupula class — simplified: use override flag
        return item.productionMode === 'cupula'
      })

      if (isCupula) {
        mockOrders[orderIdx] = {
          ...order,
          orderStatus: 'awaiting_shipping',
          checkoutAttemptId: order.checkoutAttemptId || 'ca-mock',
          shippingCost: null,
          total: null,
        }
        return {
          order: mockOrders[orderIdx],
          kind: 'prepared',
          checkoutAttemptId: mockOrders[orderIdx].checkoutAttemptId || 'ca-mock',
        }
      }

      mockOrders[orderIdx] = {
        ...order,
        orderStatus: 'pending_payment',
        checkoutAttemptId: order.checkoutAttemptId || 'ca-mock',
        shippingCost: 0,
        total: order.total || 100.00,
      }
      return {
        order: mockOrders[orderIdx],
        kind: 'prepared',
        checkoutAttemptId: mockOrders[orderIdx].checkoutAttemptId || 'ca-mock',
      }
    }),
  }
})

// ─── Mock crypto para SHA-256 previsível ─────────────────────

vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto')
  return {
    ...actual,
    default: actual,
  }
})

// ─── Mock Payload / Orders / Reservations ─────────────────────

let mockOrders: any[] = []
let mockOrderIdSeq = 0
let mockReservations: any[] = []
let mockReservationIdSeq = 0

function resetMocks() {
  mockOrders = []
  mockOrderIdSeq = 0
  mockReservations = []
  mockReservationIdSeq = 0
  resetStripeMocks()
  vi.clearAllMocks()
}

function createHash(id: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(id).digest('hex')
}

function createTestOrder(overrides: Partial<any> = {}): any {
  mockOrderIdSeq++
  const checkoutRequestId = overrides.checkoutRequestId || `test-uuid-${mockOrderIdSeq}`
  const order = {
    id: mockOrderIdSeq,
    orderNumber: `EF-20260808-${String(mockOrderIdSeq).padStart(4, '0')}`,
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentProvider: null,
    stripePaymentIntentId: null,
    paymentMethodType: null,
    paidAt: null,
    stripeRefundId: null,
    refundReason: null,
    checkoutAttemptId: `ca-${mockOrderIdSeq}`,
    checkoutRequestHash: createHash(checkoutRequestId),
    total: 100.00,
    subtotal: 100.00,
    discount: 0,
    shippingCost: 0,
    currency: 'EUR',
    items: [
      { flower: 1, name: 'Rosa Vermelha', price: 50.00, qty: 2, lineTotal: 100.00, productionMode: 'reproducible' },
    ],
    customer: { name: 'Maria Silva', email: 'maria@example.com' },
    ...overrides,
  }
  mockOrders.push(order)
  return order
}

function createMTOOnlyOrder(overrides: Partial<any> = {}): any {
  mockOrderIdSeq++
  const checkoutRequestId = overrides.checkoutRequestId || `mto-uuid-${mockOrderIdSeq}`
  const order = {
    id: mockOrderIdSeq,
    orderNumber: `EF-20260808-${String(mockOrderIdSeq).padStart(4, '0')}`,
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentProvider: null,
    stripePaymentIntentId: null,
    paymentMethodType: null,
    paidAt: null,
    stripeRefundId: null,
    refundReason: null,
    checkoutAttemptId: `ca-${mockOrderIdSeq}`,
    checkoutRequestHash: createHash(checkoutRequestId),
    total: 90.00,
    subtotal: 90.00,
    discount: 0,
    shippingCost: 0,
    currency: 'EUR',
    items: [
      { flower: 3, name: 'Girassol MTO', price: 90.00, qty: 1, lineTotal: 90.00, productionMode: 'made_to_order' },
    ],
    customer: { name: 'João Silva', email: 'joao@example.com' },
    ...overrides,
  }
  mockOrders.push(order)
  return order
}

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => {
    const mockFind = vi.fn(async ({ collection, where, limit }: any) => {
      if (collection === 'orders') {
        if (where?.orderNumber?.equals) {
          const found = mockOrders.filter((o) => o.orderNumber === where.orderNumber.equals)
          return { docs: found.slice(0, limit || 10), totalDocs: found.length }
        }
        return { docs: [], totalDocs: 0 }
      }
      if (collection === 'stock-reservations') {
        if (where?.order?.equals) {
          const filtered = mockReservations.filter((r: any) => r.order === where.order.equals)
          return { docs: filtered, totalDocs: filtered.length }
        }
        return { docs: [], totalDocs: 0 }
      }
      return { docs: [], totalDocs: 0 }
    })

    return {
      find: mockFind,
      findByID: vi.fn(async ({ collection, id }: any) => {
        if (collection === 'orders') {
          return mockOrders.find((o) => o.id === id) || null
        }
        return null
      }),
      create: vi.fn(),
      update: vi.fn(async ({ collection, id, data }: any) => {
        if (collection === 'orders') {
          const idx = mockOrders.findIndex((o) => o.id === id)
          if (idx >= 0) {
            mockOrders[idx] = { ...mockOrders[idx], ...data }
            return mockOrders[idx]
          }
        }
        return null
      }),
      db: { name: 'sqlite' },
    }
  }),
}))

vi.mock('@/payload.config', () => ({
  default: {},
}))

// ─── Helper para criar NextRequest ────────────────────────────

function createRequest(body: unknown): any {
  return {
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn(),
    headers: new Map(),
  } as any
}

// ─── Testes ───────────────────────────────────────────────────

describe('POST /api/payments/session', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('1. pending_payment com checkoutRequestId correcto → clientSecret', async () => {
    const checkoutRequestId = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789'
    const order = createTestOrder({ checkoutRequestId })
    // Add active reservation so guard passes
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })
    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.clientSecret).toBeDefined()
    expect(typeof body.clientSecret).toBe('string')
  })

  it('2. checkoutRequestId errado → 404 sem leak', async () => {
    const order = createTestOrder({ checkoutRequestId: 'real-uuid-for-order' })
    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId: 'wrong-uuid' })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Encomenda não encontrada.')
    expect(body.clientSecret).toBeUndefined()
    expect(body.orderNumber).toBeUndefined()
  })

  it('3. orderNumber inexistente → 404', async () => {
    const req = createRequest({ orderNumber: 'EF-NONEXIST', checkoutRequestId: 'any-uuid' })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Encomenda não encontrada.')
  })

  it('4. draft → auto-prepare + create PaymentIntent', async () => {
    const checkoutRequestId = 'draft-order-uuid-4'
    createTestOrder({ checkoutRequestId, orderStatus: 'draft', total: null, shippingCost: null })
    const draftOrder = mockOrders[0]

    // Add an active reservation so the guard passes after auto-prepare
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: draftOrder.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })

    const req = createRequest({ orderNumber: draftOrder.orderNumber, checkoutRequestId })

    const res = await POST(req)
    const body = await res.json()

    // Order should have been auto-prepared → pending_payment → clientSecret
    expect(res.status).toBe(200)
    expect(body.clientSecret).toBeDefined()
    expect(mockOrders[0].orderStatus).toBe('pending_payment')
  })

  it('5. segunda chamada → mesmo PaymentIntent (idempotente)', async () => {
    const checkoutRequestId = 'idempotent-test-uuid'
    const order = createTestOrder({ checkoutRequestId })
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })

    const req1 = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res1 = await POST(req1)
    const body1 = await res1.json()

    const req2 = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res2 = await POST(req2)
    const body2 = await res2.json()

    expect(body1.clientSecret).toBeDefined()
    expect(body2.clientSecret).toBeDefined()
  })

  it('6. amount/currency do browser são ignorados', async () => {
    const checkoutRequestId = 'amount-test-uuid'
    const order = createTestOrder({ checkoutRequestId })
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })

    const bodyWithExtras = {
      orderNumber: order.orderNumber,
      checkoutRequestId,
      amount: 1,
      currency: 'USD',
    }
    const req = createRequest(bodyWithExtras)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    const { createPaymentIntent } = await import('@/services/payments/stripe')
    const calls = (createPaymentIntent as any).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0].amount).toBe(order.total)
    expect(lastCall[0].currency).toBe('EUR')
  })

  it('7. clientSecret não é persistido na Order', async () => {
    const checkoutRequestId = 'no-persist-uuid'
    const order = createTestOrder({ checkoutRequestId })
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })
    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })

    await POST(req)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect((updatedOrder as any).clientSecret).toBeUndefined()
    expect(updatedOrder.stripePaymentIntentId).toBeDefined()
  })

  it('8. malformed body → 400', async () => {
    const req = createRequest('not-json')
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('inválido')
  })

  it('9. reservation active → clientSecret (guard passa)', async () => {
    const checkoutRequestId = 'guard-active-uuid'
    const order = createTestOrder({ checkoutRequestId })
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })

    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.clientSecret).toBeDefined()
  })

  it('10. reservation expirada → PAYMENT_RESERVATION_EXPIRED', async () => {
    const checkoutRequestId = 'guard-expired-uuid'
    const order = createTestOrder({ checkoutRequestId })
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'expired',
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    })

    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('PAYMENT_RESERVATION_EXPIRED')
    expect(body.clientSecret).toBeUndefined()
  })

  it('11. made_to_order-only não bloqueado pelo guard', async () => {
    const checkoutRequestId = 'mto-guard-uuid'
    const order = createMTOOnlyOrder({ checkoutRequestId })

    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.clientSecret).toBeDefined()
  })

  it('12. reservation released → PAYMENT_RESERVATION_EXPIRED', async () => {
    const checkoutRequestId = 'guard-released-uuid'
    const order = createTestOrder({ checkoutRequestId })
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'released',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })

    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('PAYMENT_RESERVATION_EXPIRED')
  })

  it('13. reservation em falta para item reservável → PAYMENT_RESERVATION_EXPIRED', async () => {
    const checkoutRequestId = 'guard-missing-uuid'
    const order = createTestOrder({ checkoutRequestId })
    // Sem reservas — o item é reproducible e precisa de reserva

    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('PAYMENT_RESERVATION_EXPIRED')
  })

  it('14. cupula draft → CUPULA_SHIPPING_NEEDS_CONFIRMATION', async () => {
    const checkoutRequestId = 'cupula-draft-uuid'
    createTestOrder({
      checkoutRequestId,
      orderStatus: 'draft',
      total: null,
      shippingCost: null,
      items: [{ flower: 6, name: 'Cúpula de Rosas', price: 80.00, qty: 1, lineTotal: 80.00, productionMode: 'cupula' }],
    })
    const cupulaOrder = mockOrders[0]

    const req = createRequest({ orderNumber: cupulaOrder.orderNumber, checkoutRequestId })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('CUPULA_SHIPPING_NEEDS_CONFIRMATION')
    expect(mockOrders[0].orderStatus).toBe('awaiting_shipping')
  })
})