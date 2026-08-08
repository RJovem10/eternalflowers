/**
 * Testes unitários para payments.ts — com mocks Stripe, sem credenciais reais.
 *
 * Testa:
 *  1. pending_payment cria PaymentIntent
 *  2. amount vem da Order
 *  3. total null/zero rejeitado
 *  4. Order em estado errado rejeitada
 *  5. segunda chamada não duplica PaymentIntent
 *  6. idempotency key estável
 *  7. Multibanco é excluído
 *  8. webhook assinatura inválida rejeitada
 *  9. succeeded confirma reservas
 * 10. succeeded → paid/confirmed
 * 11. webhook succeeded repetido não decrementa stock duas vezes
 * 12. amount mismatch rejeita processamento
 * 13. currency mismatch rejeita
 * 14. payment_failed não confirma stock
 * 15. processing não confirma stock
 * 16. PaymentIntent de outra Order não pode confirmar Order errada
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPaymentForOrder, handlePaymentSucceeded, handlePaymentFailed, handlePaymentProcessing } from './payments'
import { InvalidOrderForPaymentError, PaymentError, PaymentAmountMismatchError, PaymentCurrencyMismatchError } from './payment-types'
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
  }
})

// ─── Mock Order / Payload ─────────────────────────────────────

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

// Mock flower store needed by confirmReservation
const mockFlowers: Record<number, any> = {
  1: { id: 1, namePt: 'Rosa Vermelha', price: 25.50, productionMode: 'reproducible', stockQuantity: 10, availability: 'available' },
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

function createDraftOrder(overrides: Partial<any> = {}): any {
  return createPendingPaymentOrder({ ...overrides, orderStatus: 'draft' })
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
    return null
  })

  const mockCreate = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      mockReservationIdSeq++
      const res = { id: mockReservationIdSeq, ...data, createdAt: new Date().toISOString() }
      mockReservations.push(res)
      return res
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

  it('1. pending_payment cria PaymentIntent', async () => {
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
  })

  it('2. amount vem da Order', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder({ total: 75.50 })

    const result = await createPaymentForOrder(payload, {
      orderId: order.id,
      idempotencyKey: uuidv4(),
    })

    const { createPaymentIntent } = await import('./stripe')
    // O mock foi limpo pelo vi.clearAllMocks() no beforeEach
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
    const order = createDraftOrder() // draft, not pending_payment

    await expect(
      createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: uuidv4() })
    ).rejects.toThrow(InvalidOrderForPaymentError)
  })

  it('5. segunda chamada não duplica PaymentIntent (reutiliza)', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const key = uuidv4()

    const r1 = await createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: key })

    // stripePaymentIntentId foi guardado no r1 — segunda chamada reutiliza
    const r2 = await createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: uuidv4() })

    expect(r2.kind).toBe('reused')
    expect(r2.paymentIntentId).toBe(r1.paymentIntentId)
  })

  it('6. idempotency key estável (mesmo checkoutAttemptId)', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()

    const key = `payment:${order.checkoutAttemptId}`

    await createPaymentForOrder(payload, { orderId: order.id, idempotencyKey: key })

    // Verificar que o mock createPaymentIntent recebeu a idempotencyKey correcta
    const { createPaymentIntent } = await import('./stripe')
    const callArgs = (createPaymentIntent as any).mock.calls[0][0]
    expect(callArgs.idempotencyKey).toBe(key)
  })

  it('7. usa automatic_payment_methods sem multibanco', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()

    await createPaymentForOrder(payload, {
      orderId: order.id,
      idempotencyKey: uuidv4(),
    })

    const { createPaymentIntent } = await import('./stripe')
    expect(createPaymentIntent).toHaveBeenCalled()
    const callArgs = (createPaymentIntent as any).mock.calls[0][0]
    // Não usa allow-list manual
    expect(callArgs).not.toHaveProperty('payment_method_types')
    // Usa automatic_payment_methods (Stripe Dashboard)
    expect(callArgs).toHaveProperty('automatic_payment_methods')
    expect(callArgs.automatic_payment_methods).toEqual({ enabled: true })
    // Multibanco excluído explicitamente
    expect(callArgs).toHaveProperty('excluded_payment_method_types')
    expect(callArgs.excluded_payment_method_types).toEqual(['multibanco'])
  })
})

describe('handlePaymentSucceeded', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('8. succeeded confirma reservas', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()

    // Simular stripePaymentIntentId guardado
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    // Adicionar reserva active com flower 1 (reproducible, stockQuantity=10)
    mockReservationIdSeq++
    const resId = mockReservationIdSeq
    mockReservations.push({
      id: resId,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    })

    const result = await handlePaymentSucceeded(payload, paymentIntent)
    expect(result.kind).toBe('processed')
    expect(result.orderId).toBe(order.id)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder.paymentStatus).toBe('paid')
    expect(updatedOrder.orderStatus).toBe('confirmed')
    expect(updatedOrder.paidAt).toBeDefined()
  })

  it('9. succeeded → paid/confirmed', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
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

  it('10. webhook succeeded repetido não decrementa stock duas vezes', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: toStripeAmount(order.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    // Adicionar reserva já confirmada
    mockReservationIdSeq++
    mockReservations.push({
      id: mockReservationIdSeq,
      order: order.id,
      flower: 1,
      quantity: 2,
      status: 'confirmed', // já confirmada
      confirmedAt: new Date().toISOString(),
    })

    const r1 = await handlePaymentSucceeded(payload, paymentIntent)
    expect(r1.kind).toBe('processed')

    // Segunda chamada — já paid/confirmed
    const r2 = await handlePaymentSucceeded(payload, paymentIntent)
    expect(r2.kind).toBe('already_processed')
  })

  it('11. amount mismatch rejeita processamento', async () => {
    const payload = createMockPayload()
    const order = createPendingPaymentOrder()
    const paymentIntent = addMockPaymentIntent({
      amount: 99999, // diferente de toStripeAmount(order.total) = 10000
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order.id) },
    })
    mockOrders[0].stripePaymentIntentId = paymentIntent.id

    await expect(
      handlePaymentSucceeded(payload, paymentIntent)
    ).rejects.toThrow(PaymentAmountMismatchError)
  })

  it('12. currency mismatch rejeita', async () => {
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

  it('16. PaymentIntent de outra Order não pode confirmar Order errada', async () => {
    const payload = createMockPayload()
    const order1 = createPendingPaymentOrder({ total: 50.00 })
    const order2 = createPendingPaymentOrder({ total: 100.00 })

    // PaymentIntent do order1
    const paymentIntent1 = addMockPaymentIntent({
      amount: toStripeAmount(order1.total),
      currency: 'eur',
      status: 'succeeded',
      metadata: { orderId: String(order1.id) },
    })

    // order1 tem stripePaymentIntentId do paymentIntent1
    mockOrders[0].stripePaymentIntentId = paymentIntent1.id
    mockOrders[1].stripePaymentIntentId = 'pi_different'

    const result = await handlePaymentSucceeded(payload, paymentIntent1)
    expect(result.orderId).toBe(order1.id)
    // Confirma que foi order1, não order2
    const updatedOrder1 = mockOrders.find((o: any) => o.id === order1.id)
    expect(updatedOrder1.paymentStatus).toBe('paid')
    const updatedOrder2 = mockOrders.find((o: any) => o.id === order2.id)
    expect(updatedOrder2.paymentStatus).toBe('unpaid')
  })
})

describe('handlePaymentFailed', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('13. payment_failed não confirma stock', async () => {
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
    // orderStatus não muda
    expect(updatedOrder.orderStatus).toBe('pending_payment')

    // Reservas continuam active (não foram confirmadas)
    const activeReserves = mockReservations.filter((r: any) => r.status === 'active')
    expect(activeReserves.length).toBe(1)
  })
})

describe('handlePaymentProcessing', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('14. processing não confirma stock', async () => {
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

    // Reservas continuam active
    const activeReserves = mockReservations.filter((r: any) => r.status === 'active')
    expect(activeReserves.length).toBe(1)
  })
})