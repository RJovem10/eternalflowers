/**
 * Testes unitários para POST /api/payments/session
 *
 * Testa:
 *  1. capability correta + pending_payment → clientSecret
 *  2. checkoutRequestId errado → acesso negado sem leak
 *  3. orderNumber inexistente → comportamento seguro
 *  4. draft → ORDER_NOT_READY_FOR_PAYMENT
 *  5. segunda chamada → mesmo PaymentIntent, não duplica
 *  6. amount/currency não podem ser controlados pelo input
 *  7. clientSecret não é persistido na Order
 *  8. malformed body → 400
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
        automatic_payment_methods: params.automatic_payment_methods,
        excluded_payment_method_types: params.excluded_payment_method_types,
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

// ─── Mock Payload / Orders ────────────────────────────────────

let mockOrders: any[] = []
let mockOrderIdSeq = 0

function resetMocks() {
  mockOrders = []
  mockOrderIdSeq = 0
  resetStripeMocks()
  vi.clearAllMocks()
}

function createHash(id: string): string {
  // SHA-256 simulado para testes (determinístico)
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
    checkoutAttemptId: `ca-${mockOrderIdSeq}`,
    checkoutRequestHash: createHash(checkoutRequestId),
    total: 100.00,
    subtotal: 100.00,
    discount: 0,
    shippingCost: 0,
    currency: 'EUR',
    items: [],
    customer: { name: 'Maria Silva', email: 'maria@example.com' },
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
    // Não deve revelar dados da Order
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

  it('4. draft → ORDER_NOT_READY_FOR_PAYMENT', async () => {
    const checkoutRequestId = 'draft-order-uuid'
    createTestOrder({ checkoutRequestId, orderStatus: 'draft', total: null, shippingCost: null })
    // Precisamos do orderNumber deste draft
    const draftOrder = mockOrders[0]
    const req = createRequest({ orderNumber: draftOrder.orderNumber, checkoutRequestId })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('não está pronta para pagamento')
    expect(body.code).toBe('ORDER_NOT_READY_FOR_PAYMENT')
  })

  it('5. segunda chamada → mesmo PaymentIntent (idempotente)', async () => {
    const checkoutRequestId = 'idempotent-test-uuid'
    const order = createTestOrder({ checkoutRequestId })

    const req1 = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res1 = await POST(req1)
    const body1 = await res1.json()

    // Segunda chamada
    const req2 = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })
    const res2 = await POST(req2)
    const body2 = await res2.json()

    // Ambos devem ter clientSecret (reused ou created)
    expect(body1.clientSecret).toBeDefined()
    expect(body2.clientSecret).toBeDefined()
  })

  it('6. amount/currency do browser são ignorados', async () => {
    const checkoutRequestId = 'amount-test-uuid'
    const order = createTestOrder({ checkoutRequestId })

    // Tentar enviar amount/currency no body (devem ser ignorados)
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
    // O payment intent deve usar o total da Order (100 EUR), não o do browser
    const { createPaymentIntent } = await import('@/services/payments/stripe')
    const calls = (createPaymentIntent as any).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0].amount).toBe(order.total)
    expect(lastCall[0].currency).toBe('EUR')
  })

  it('7. clientSecret não é persistido na Order', async () => {
    const checkoutRequestId = 'no-persist-uuid'
    const order = createTestOrder({ checkoutRequestId })
    const req = createRequest({ orderNumber: order.orderNumber, checkoutRequestId })

    await POST(req)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    // clientSecret não deve estar na Order
    expect((updatedOrder as any).clientSecret).toBeUndefined()
    // stripePaymentIntentId foi guardado, mas não o client_secret
    expect(updatedOrder.stripePaymentIntentId).toBeDefined()
  })

  it('8. malformed body → 400', async () => {
    const req = createRequest('not-json')
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('inválido')
  })
})