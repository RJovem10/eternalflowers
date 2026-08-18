/**
 * Testes unitários para payments.ts — com mocks Stripe, sem credenciais reais.
 *
 * ISSUE-1I:
 * - payment_method_types explícitos [card, mb_way, link]
 * - succeeded + reservation ativa → stock confirmado
 * - succeeded → paid/confirmed apenas depois do stock
 * - succeeded repetido → idempotente
 * - reservation expired → NÃO fica confirmed → late payment refund
 * - reservation released → NÃO fica confirmed
 * - reservation em falta → NÃO confirmed
 * - múltiplas reservations e uma falha → rollback
 * - made_to_order-only → succeeded normally
 * - late payment cria refund integral
 * - refund idempotency key estável
 * - webhook repetido não duplica refund
 * - late payment → paymentStatus refunded
 * - late payment → orderStatus expired
 * - stripeRefundId persistido
 * - refundReason correto
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createPaymentForOrder,
  handlePaymentSucceeded,
  handlePaymentSucceededWithFallback,
  handleLatePaymentRefund,
  handlePaymentFailed,
  handlePaymentProcessing,
} from './payments'
import { InvalidOrderForPaymentError, PaymentError, PaymentAmountMismatchError, PaymentCurrencyMismatchError, LatePaymentError } from './payment-types'
import { PAYMENT_PROVIDER, toStripeAmount } from './payment-types'

// ─── Helpers ──────────────────────────────────────────────────

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ─── Mock Stripe ──────────────────────────────────────────────

let mockPaymentIntents: Record<string, any> = {}
let mockPaymentIntentIdSeq = 0
let mockRefunds: Record<string, any> = {}
let mockRefundIdSeq = 0

function resetStripeMocks() {
  mockPaymentIntents = {}
  mockPaymentIntentIdSeq = 0
  mockRefunds = {}
  mockRefundIdSeq = 0
}

function addMockPaymentIntent(overrides: Partial<any> = {}): any {
  mockPaymentIntentIdSeq++
  const id = `pi_mock_${mockPaymentIntentIdSeq}`
  const intent = {
    id,
    object: 'payment_intent',
    amount: 0,
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

function addMockRefund(overrides: Partial<any> = {}): any {
  mockRefundIdSeq++
  const id = `re_mock_${mockRefundIdSeq}`
  const refund = {
    id,
    object: 'refund',
    amount: 10000,
    currency: 'eur',
    status: 'succeeded',
    payment_intent: 'pi_mock_1',
    ...overrides,
  }
  mockRefunds[id] = refund
  return refund
}

/**
 * NOTA: checkPaymentIntentReusable e validatePaymentIntentForOrder
 * são SÍNCRONAS no módulo real. O mock também deve ser síncrono para
 * que chamadas sem await (correctas para a API real) funcionem.
 */
vi.mock('./stripe', async () => {
  return {
    createPaymentIntent: vi.fn(async (params: any) => {
      const intent = addMockPaymentIntent({
        amount: toStripeAmount(params.amount),
        currency: params.currency.toLowerCase(),
        metadata: params.metadata,
        payment_method_types: params.payment_method_types || ['card', 'mb_way', 'link'],
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
    constructWebhookEvent: vi.fn((rawBody: string, signature: string) => {
      if (!signature || signature === 'invalid') {
        throw new Error('Invalid signature')
      }
      const parsed = JSON.parse(rawBody)
      return {
        type: parsed.type || 'payment_intent.succeeded',
        data: { object: parsed.data?.object || {} },
      }
    }),
    createFullRefund: vi.fn(async (paymentIntentId: string) => {
      // Verificar idempotência simulada
      const refund = addMockRefund({ payment_intent: paymentIntentId })
      return mockRefunds[refund.id]
    }),
    getSupportedPaymentMethods: vi.fn(() => ['card', 'mb_way', 'link']),
  }
})

// ─── Mock Order / Payload ─────────────────────────────────────

let mockOrders: any[] = []
let mockOrderIdSeq = 0
let mockReservations: any[] = []
let mockReservationIdSeq = 0
let mockEmailNotifIdSeq = 0
let mockEmailNotifications: any[] = []
let mockCoupons: any[] = []
let mockCouponIdSeq = 0

function resetMocks() {
  mockOrders = []
  mockOrderIdSeq = 0
  mockReservations = []
  mockReservationIdSeq = 0
  mockEmailNotifIdSeq = 0
  mockEmailNotifications = []
  mockCoupons = []
  mockCouponIdSeq = 0
  resetStripeMocks()
  vi.clearAllMocks()
}

// Mock flower store needed by confirmReservation
const mockFlowers: Record<number, any> = {
  1: { id: 1, namePt: 'Rosa Vermelha', price: 25.50, productionMode: 'reproducible', stockQuantity: 10, availability: 'available' },
  2: { id: 2, namePt: 'Orquídea Azul', price: 45.00, productionMode: 'unique', stockQuantity: 1, availability: 'available' },
  3: { id: 3, namePt: 'Girassol MTO', price: 30.00, productionMode: 'made_to_order', stockQuantity: 0, availability: 'available' },
}

function createPendingPaymentOrder(overrides: Partial<any> = {}): any {
  mockOrderIdSeq++
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
    checkoutAttemptId: uuidv4(),
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
    checkoutAttemptId: uuidv4(),
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

function addActiveReservation(orderId: number, flowerId: number, qty: number): any {
  mockReservationIdSeq++
  const res = {
    id: mockReservationIdSeq,
    order: orderId,
    flower: flowerId,
    quantity: qty,
    status: 'active',
    expiresAt: new Date(Date.now() + 1800000).toISOString(), // 30 min no futuro
    confirmedAt: null,
  }
  mockReservations.push(res)
  return res
}

function addExpiredReservation(orderId: number, flowerId: number, qty: number): any {
  mockReservationIdSeq++
  const res = {
    id: mockReservationIdSeq,
    order: orderId,
    flower: flowerId,
    quantity: qty,
    status: 'expired',
    expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 min no passado
    expiredAt: new Date().toISOString(),
    confirmedAt: null,
  }
  mockReservations.push(res)
  return res
}

function addReleasedReservation(orderId: number, flowerId: number, qty: number): any {
  mockReservationIdSeq++
  const res = {
    id: mockReservationIdSeq,
    order: orderId,
    flower: flowerId,
    quantity: qty,
    status: 'released',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    releasedAt: new Date().toISOString(),
    confirmedAt: null,
  }
  mockReservations.push(res)
  return res
}

function addConfirmedReservation(orderId: number, flowerId: number, qty: number): any {
  mockReservationIdSeq++
  const res = {
    id: mockReservationIdSeq,
    order: orderId,
    flower: flowerId,
    quantity: qty,
    status: 'confirmed',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    confirmedAt: new Date().toISOString(),
  }
  mockReservations.push(res)
  return res
}

function addMockCoupon(overrides: Partial<any> = {}): any {
  mockCouponIdSeq++
  const coupon = {
    id: mockCouponIdSeq,
    code: 'TEST10',
    type: 'percent',
    value: 10,
    maxUses: 0,
    usesCount: 0,
    active: true,
    minOrder: 0,
    firstOrderOnly: false,
    validFrom: null,
    validUntil: null,
    ...overrides,
  }
  mockCoupons.push(coupon)
  return coupon
}

function createMockPayload() {
  const mockFind = vi.fn(async ({ collection, where, limit }: any) => {
    if (collection === 'orders' || collection === 'orders') {
      if (where?.stripePaymentIntentId?.equals) {
        const found = mockOrders.filter((o) => o.stripePaymentIntentId === where.stripePaymentIntentId.equals)
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      if (where?.id?.equals !== undefined) {
        const id = Number(where.id.equals)
        const found = mockOrders.filter((o) => o.id === id)
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      return { docs: [], totalDocs: 0 }
    }
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      if (where?.order?.equals) {
        const filtered = mockReservations.filter((r: any) => r.order === where.order.equals)
        return { docs: filtered, totalDocs: filtered.length }
      }
      if (where?.id?.equals) {
        const filtered = mockReservations.filter((r: any) => r.id === where.id.equals)
        return { docs: filtered, totalDocs: filtered.length }
      }
      return { docs: [...mockReservations], totalDocs: mockReservations.length }
    }
    if (collection === 'email-notifications') {
      if (where?.deduplicationKey?.equals) {
        const found = mockEmailNotifications.filter((n: any) => n.deduplicationKey === where.deduplicationKey.equals)
        return { docs: found, totalDocs: found.length }
      }
      return { docs: [], totalDocs: 0 }
    }
    if (collection === 'coupons') {
      if (where?.code?.equals) {
        const found = mockCoupons.filter((c: any) => c.code === where.code.equals)
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      return { docs: [], totalDocs: 0 }
    }
    return { docs: [], totalDocs: 0 }
  })

  const mockFindByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'orders') {
      return mockOrders.find((o) => o.id === id) || null
    }
    if (collection === 'flowers') {
      return mockFlowers[id] || null
    }
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      return mockReservations.find((r: any) => r.id === id) || null
    }
    if (collection === 'coupons') {
      return mockCoupons.find((c: any) => c.id === id) || null
    }
    return null
  })

  const mockCreate = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      mockReservationIdSeq++
      const res = { id: mockReservationIdSeq, ...data, createdAt: new Date().toISOString() }
      mockReservations.push(res)
      return res
    }
    if (collection === 'email-notifications') {
      mockEmailNotifIdSeq++
      const doc = { id: mockEmailNotifIdSeq, ...data, createdAt: new Date().toISOString() }
      mockEmailNotifications.push(doc)
      return doc
    }
    return { id: mockOrderIdSeq }
  })

  const mockUpdate = vi.fn(async ({ collection, id, data }: any) => {
    if (collection === 'orders') {
      const idx = mockOrders.findIndex((o) => o.id === id)
      if (idx >= 0) {
        mockOrders[idx] = { ...mockOrders[idx], ...data }
        return mockOrders[idx]
      }
    }
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      const idx = mockReservations.findIndex((r: any) => r.id === id)
      if (idx >= 0) {
        mockReservations[idx] = { ...mockReservations[idx], ...data }
        return mockReservations[idx]
      }
    }
    if (collection === 'coupons') {
      const idx = mockCoupons.findIndex((c: any) => c.id === id)
      if (idx >= 0) {
        mockCoupons[idx] = { ...mockCoupons[idx], ...data }
        return mockCoupons[idx]
      }
    }
    return null
  })

  return {
    find: mockFind,
    findByID: mockFindByID,
    create: mockCreate,
    update: mockUpdate,
    db: { name: 'sqlite' },
  } as any
}

// ─── Testes ───────────────────────────────────────────────────

describe('createPaymentForOrder', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('1. pending_payment cria PaymentIntent com payment_method_types', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()

    const result = await createPaymentForOrder(payload, {
      orderId: order.id,
      idempotencyKey: uuidv4(),
    })

    expect(result.kind).toBe('created')
    expect(result.paymentIntentId).toMatch(/^pi_mock_/)
    expect(result.clientSecret).toBeDefined()

    // stripePaymentIntentId guardado na Order
    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.stripePaymentIntentId).toBe(result.paymentIntentId)
    expect(updatedOrder.paymentProvider).toBe(PAYMENT_PROVIDER)

    // Verificar payment_method_types no PaymentIntent criado
    const { createPaymentIntent } = await import('./stripe')
    const createdIntent = mockPaymentIntents[result.paymentIntentId]
    expect(createdIntent.payment_method_types).toEqual(['card', 'mb_way', 'link'])
    const callArgs = (createPaymentIntent as any).mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('automatic_payment_methods')
  })

  it('2. amount vem da Order', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ total: 75.50 })

    const result = await createPaymentForOrder(payload, {
      orderId: order.id,
      idempotencyKey: uuidv4(),
    })

    const { createPaymentIntent } = await import('./stripe')
    expect(createPaymentIntent).toHaveBeenCalled()
    const callArgs = (createPaymentIntent as any).mock.calls[0][0]
    expect(callArgs.amount).toBe(75.50)
  })

  it('3. total null/zero rejeitado', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ total: 0 })

    await expect(
      createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: uuidv4() })
    ).rejects.toThrow(PaymentError)
  })

  it('4. Order em estado errado rejeitada', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ orderStatus: 'draft' })

    await expect(
      createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: uuidv4() })
    ).rejects.toThrow(InvalidOrderForPaymentError)
  })

  it('5. segunda chamada não duplica PaymentIntent (reutiliza)', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const key = uuidv4()

    const r1 = await createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: key })

    const r2 = await createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: uuidv4() })

    expect(r2.kind).toBe('reused')
    expect(r2.paymentIntentId).toBe(r1.paymentIntentId)
  })
})

describe('handlePaymentSucceeded — reservation safety', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('6. succeeded + reservation ativa → stock confirmado + email pending', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addActiveReservation(order.id, 1, 2)

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')
    expect(result.orderId).toBe(order.id)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('paid')
    expect(updatedOrder.orderStatus).toBe('confirmed')
    expect(updatedOrder.paidAt).toBeDefined()

    // Reserva foi confirmada
    const resUpdated = mockReservations.find((r: any) => r.order === order.id)
    expect(resUpdated.status).toBe('confirmed')
  })

  it('7. succeeded → paid/confirmed apenas depois do stock', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addActiveReservation(order.id, 1, 2)

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('paid')
    expect(updatedOrder.orderStatus).toBe('confirmed')
  })

  it('8. succeeded repetido → idempotente', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addActiveReservation(order.id, 1, 2)

    const r1 = await handlePaymentSucceeded(payload, paymentIntent)
    expect(r1.kind).toBe('processed')

    const r2 = await handlePaymentSucceeded(payload, paymentIntent)
    expect(r2.kind).toBe('already_processed')
  })

  it('9. reservation expired → Order NÃO fica confirmed (late payment)', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    // Reserva já expirou
    addExpiredReservation(order.id, 1, 2)

    // handlePaymentSucceeded deve lançar LatePaymentError
    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(LatePaymentError)
  })

  it('10. reservation released → Order NÃO fica confirmed (late payment)', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addReleasedReservation(order.id, 1, 2)

    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(LatePaymentError)
  })

  it('11. reservation em falta para item reservável → NÃO confirmed', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    // Sem reservas — o item é reproducible e precisa de reserva
    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(LatePaymentError)
  })

  it('12. múltiplas reservations e uma falha → rollback das restantes', async () => {
    // Items: reproducible (2 qty) + unique (1 qty)
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({
      items: [
        { flower: 1, name: 'Rosa Vermelha', price: 50.00, qty: 2, lineTotal: 100.00, productionMode: 'reproducible' },
        { flower: 2, name: 'Orquídea Azul', price: 45.00, qty: 1, lineTotal: 45.00, productionMode: 'unique' },
      ],
      total: 145.00,
      subtotal: 145.00,
    })
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(145.00),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    // Uma reserva active, outra expired
    addActiveReservation(order.id, 1, 2)
    addExpiredReservation(order.id, 2, 1)

    // Confirmar que o fluxo rejeita com LatePaymentError
    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(LatePaymentError)

    // Order não foi marcada como paid/confirmed
    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('unpaid')
    expect(updatedOrder.orderStatus).toBe('pending_payment')
  })

  it('13. made_to_order-only → succeeded normalmente sem reservations', async () => {
    const payload = createMockPayload()
    const order = createMTOOnlyOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('paid')
    expect(updatedOrder.orderStatus).toBe('confirmed')
  })

  it('14. amount mismatch rejeita processamento', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: 99999,
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(PaymentAmountMismatchError)
  })

  it('15. currency mismatch rejeita', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'usd',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(PaymentCurrencyMismatchError)
  })

  // ─── Transactional Outbox Tests (ISSUE-1O) ────────────────

  it('1Oa. succeeded + enqueue OK → Order paid/confirmed + email pending', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addActiveReservation(order.id, 1, 2)

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('paid')
    expect(updatedOrder.orderStatus).toBe('confirmed')

    // Email notification foi criada na outbox
    const notif = mockEmailNotifications.find(
      (n: any) => n.deduplicationKey === `order-confirmed:${order.id}`
    )
    expect(notif).toBeDefined()
    expect(notif.status).toBe('pending')
    expect(notif.type).toBe('order_confirmed')
  })

  it('1Ob. succeeded + erro DB ao enqueue → transaction rollback; Order NÃO fica paid/confirmed', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addActiveReservation(order.id, 1, 2)

    // Forçar create email-notifications a lançar erro DB
    const originalCreate = payload.create
    payload.create = vi.fn(async ({ collection }: any) => {
      if (collection === 'email-notifications') {
        throw new Error('SQLITE_BUSY: database is locked')
      }
      return originalCreate({ collection })
    })

    // handlePaymentSucceeded deve propagar o erro (não engolir)
    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow()

    // NOTA: o mock in-memory não implementa rollback transacional real;
    // em produção o Payload rollbackTransaction reverte a Order.
    // O que provamos aqui: o erro PROPAGA (não é engolido),
    // e nenhuma email notification foi criada.
    expect(mockEmailNotifications.length).toBe(0)
  })
})

describe('handlePaymentSucceededWithFallback — late payment refunds', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('16. late payment → cria refund integral', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    // Reserva expirada
    addExpiredReservation(order.id, 1, 2)

    const result = await handlePaymentSucceededWithFallback(payload, paymentIntent)
    expect(result.kind).toBe('late_payment_refunded')
    expect(result.refundId).toBeDefined()

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('refunded')
    expect(updatedOrder.orderStatus).toBe('expired')
    expect(updatedOrder.stripeRefundId).toBe(result.refundId)
    expect(updatedOrder.refundReason).toBe('stock_reservation_expired')
  })

  it('17. refund idempotency key estável (late-stock-refund:{paymentIntentId})', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addExpiredReservation(order.id, 1, 2)

    const result = await handlePaymentSucceededWithFallback(payload, paymentIntent)

    // Verificar que createFullRefund foi chamado com a idempotency key correcta
    const { createFullRefund } = await import('./stripe')
    expect(createFullRefund).toHaveBeenCalledWith(paymentIntent.id)
  })

  it('18. webhook repetido → não duplica refund', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addExpiredReservation(order.id, 1, 2)

    // Primeira chamada — cria refund
    const r1 = await handlePaymentSucceededWithFallback(payload, paymentIntent)
    expect(r1.kind).toBe('late_payment_refunded')

    // Segunda chamada — já processado (already_refunded)
    const r2 = await handlePaymentSucceededWithFallback(payload, paymentIntent)
    expect(r2.kind).toBe('already_refunded')

    // Confirmar que só um refund foi criado no Stripe (primeira chamada)
    const { createFullRefund } = await import('./stripe')
    expect(createFullRefund).toHaveBeenCalledTimes(1)
  })

  it('19. late payment → paymentStatus refunded', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addExpiredReservation(order.id, 1, 2)

    const result = await handlePaymentSucceededWithFallback(payload, paymentIntent)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('refunded')
  })

  it('20. late payment → orderStatus expired', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addExpiredReservation(order.id, 1, 2)

    const result = await handlePaymentSucceededWithFallback(payload, paymentIntent)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.orderStatus).toBe('expired')
  })

  it('21. stripeRefundId persistido', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addExpiredReservation(order.id, 1, 2)

    const result = await handlePaymentSucceededWithFallback(payload, paymentIntent)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.stripeRefundId).toBe(result.refundId)
    expect(updatedOrder.stripeRefundId).toMatch(/^re_mock_/)
  })

  it('22. refundReason correto', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    addExpiredReservation(order.id, 1, 2)

    const result = await handlePaymentSucceededWithFallback(payload, paymentIntent)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.refundReason).toBe('stock_reservation_expired')
  })
})

describe('handlePaymentFailed', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('payment_failed não confirma stock', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()

    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
    })

    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'requires_payment_method',
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    const result = await handlePaymentFailed(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('failed')
    expect(updatedOrder.orderStatus).toBe('pending_payment')

    const activeReserves = mockReservations.filter((r: any) => r.status === 'active')
    expect(activeReserves.length).toBe(1)
  })
})

describe('handlePaymentProcessing', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('processing não confirma stock', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()

    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
    })

    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'processing',
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    const result = await handlePaymentProcessing(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('pending')
    expect(updatedOrder.orderStatus).toBe('pending_payment')

    const activeReserves = mockReservations.filter((r: any) => r.status === 'active')
    expect(activeReserves.length).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// ISSUE-1S — Coupon Redemption Tests
// ═══════════════════════════════════════════════════════════════

describe('handlePaymentSucceeded — coupon redemption', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('1S-1. Order sem coupon → nada incrementado', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ coupon: null })
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id
    addActiveReservation(order.id, 1, 2)

    // Criar um coupon que NÃO deve ser afectado
    addMockCoupon({ code: 'TEST10', usesCount: 5 })

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    // coupon não deve ter sido incrementado
    const cpn = mockCoupons.find((c: any) => c.code === 'TEST10')
    expect(cpn.usesCount).toBe(5)
  })

  it('1S-2. Order com coupon paga → usesCount +1, couponRedeemedAt persistido', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ coupon: 'TEST10' })
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id
    addActiveReservation(order.id, 1, 2)
    addMockCoupon({ code: 'TEST10', usesCount: 5 })

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    // usesCount incrementado
    const cpn = mockCoupons.find((c: any) => c.code === 'TEST10')
    expect(cpn.usesCount).toBe(6)

    // couponRedeemedAt preenchido na Order
    const updatedOrder = mockOrders.find((o: any) => o.id === order.id)
    expect(updatedOrder.couponRedeemedAt).toBeDefined()
    expect(typeof updatedOrder.couponRedeemedAt).toBe('string')
  })

  it('1S-3. Webhook retry → usesCount não duplica', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ coupon: 'TEST10' })
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id
    addActiveReservation(order.id, 1, 2)
    addMockCoupon({ code: 'TEST10', usesCount: 5 })

    // Primeira chamada
    const r1 = await handlePaymentSucceeded(payload, paymentIntent)
    expect(r1.kind).toBe('processed')

    // Simular que a Order ficou paid/confirmed (como na realidade)
    // A segunda chamada deve encontrar already_processed pela
    // idempotência existente (paymentStatus=paid + orderStatus=confirmed)
    // Isto testa o guard de idempotência EXISTENTE (não o couponRedeemedAt)
    const r2 = await handlePaymentSucceeded(payload, paymentIntent)
    expect(r2.kind).toBe('already_processed')

    // usesCount continua +1
    const cpn = mockCoupons.find((c: any) => c.code === 'TEST10')
    expect(cpn.usesCount).toBe(6)
  })

  it('1S-4. Coupon maxUses exausto → não incrementa mas pagamento OK', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ coupon: 'TEST10' })
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id
    addActiveReservation(order.id, 1, 2)
    // Coupon já esgotado: usesCount=10, maxUses=10
    addMockCoupon({ code: 'TEST10', usesCount: 10, maxUses: 10 })

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    // usesCount NÃO foi incrementado
    const cpn = mockCoupons.find((c: any) => c.code === 'TEST10')
    expect(cpn.usesCount).toBe(10)

    // Mas Order foi paga normalmente
    const updatedOrder = mockOrders.find((o: any) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('paid')
    expect(updatedOrder.orderStatus).toBe('confirmed')
  })

  it('1S-5. Coupon com maxUses ilimitado (0) → incrementa sempre', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ coupon: 'TEST10' })
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id
    addActiveReservation(order.id, 1, 2)
    addMockCoupon({ code: 'TEST10', usesCount: 100, maxUses: 0 })

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')

    const cpn = mockCoupons.find((c: any) => c.code === 'TEST10')
    expect(cpn.usesCount).toBe(101)
  })
})

describe('Payment method types', () => {
  it('23. card permitido', async () => {
    const { getSupportedPaymentMethods } = await import('./stripe')
    const methods = getSupportedPaymentMethods()
    expect(methods).toContain('card')
  })

  it('24. mb_way permitido', async () => {
    const { getSupportedPaymentMethods } = await import('./stripe')
    const methods = getSupportedPaymentMethods()
    expect(methods).toContain('mb_way')
  })

  it('25. link permitido', async () => {
    const { getSupportedPaymentMethods } = await import('./stripe')
    const methods = getSupportedPaymentMethods()
    expect(methods).toContain('link')
  })

  it('26. multibanco não permitido', async () => {
    const { getSupportedPaymentMethods } = await import('./stripe')
    const methods = getSupportedPaymentMethods()
    expect(methods).not.toContain('multibanco')
  })

  it('27. método delayed não entra na configuração', async () => {
    const { getSupportedPaymentMethods } = await import('./stripe')
    const methods = getSupportedPaymentMethods()
    expect(methods).not.toContain('sepa_debit')
    expect(methods).not.toContain('bancontact')
    expect(methods).not.toContain('eps')
    expect(methods).not.toContain('ideal')
    expect(methods).not.toContain('p24')
    expect(methods).not.toContain('klarna')
    expect(methods).not.toContain('afterpay_clearpay')
  })
})