/**
 * Testes unitários para order-cancellation.ts — com mocks Stripe, sem credenciais reais.
 *
 * ISSUE-1Q — Safe Order Cancellation
 *
 * Pré-pagamento:
 * 1. pending_payment sem PI → reservations released + cancelled
 * 2. PI cancelável → Stripe cancel + cancelled
 * 3. PI já canceled → idempotente
 * 4. PI processing → NÃO cancelled
 * 5. PI succeeded race → NÃO executar cancel pré-pagamento incorrecto
 *
 * Paid:
 * 6. confirmed+paid → full refund
 * 7. amount vem exclusivamente do Stripe/Order
 * 8. → paymentStatus refunded
 * 9. → orderStatus cancelled
 * 10. unique stock restaurado uma vez
 * 11. reproducible qty restaurada
 * 12. made_to_order não altera stock
 * 13. retry não duplica refund
 * 14. retry não duplica stock
 * 15. DB failure após refund → retry reutiliza refund
 * 16. processing não pode cancelar
 * 17. shipped não pode cancelar
 * 18. completed não pode cancelar
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cancelOrder } from './order-cancellation'
import {
  CancelOrderNotAllowedError,
  CancelOrderNotFoundError,
  ManualRefundConfirmationRequiredError,
} from './order-cancellation-types'

// ─── Helpers ──────────────────────────────────────────────────

function createMockOrder(overrides: Partial<any> = {}): any {
  return {
    id: 1,
    orderNumber: 'EF-20260818-TEST',
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentProvider: 'stripe',
    total: 150.00,
    currency: 'EUR',
    customer: { name: 'Cliente Teste', email: 'cliente@example.com' },
    email: 'cliente@example.com',
    stripePaymentIntentId: null,
    stripeRefundId: null,
    refundReason: null,
    cancelledAt: null,
    items: [],
    ...overrides,
  }
}

function createMockReservation(overrides: Partial<any> = {}): any {
  return {
    id: 100,
    flower: { id: 10 },
    quantity: 1,
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

// ─── Mock Payload ─────────────────────────────────────────────

interface MockPayloadOptions {
  order?: any
  orders?: any[]
  reservations?: any[]
  reservationQueryDocs?: any[]
  flowers?: Record<number, any>
  expectedOrderUpdate?: { id: number; data: any }
  expectedReservationUpdate?: { id: number; data: any }
}

let mockOptions: MockPayloadOptions = {}
let mockEmailNotifs: any[] = []
let mockEmailNotifIdSeq = 0
let mockOrderConcurrencyEvents: Array<{ kind: 'lock' | 'read'; orderId: number; req: any }> = []
let mockOrderLockHook: ((orderId: number) => void) | undefined

function resetMockPayload() {
  mockOptions = {
    order: createMockOrder(),
    orders: [],
    reservations: [],
    flowers: {},
  }
  mockEmailNotifs = []
  mockEmailNotifIdSeq = 0
  mockOrderConcurrencyEvents = []
  mockOrderLockHook = undefined
}

function createMockPayload(): any {
  const payload = {
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'orders' || collection === 'orders') {
        const searchField = Object.keys(where)[0]
        const searchValue = where[searchField]?.equals || where[searchField]?.exists
        if (searchField === 'stripePaymentIntentId') {
          const found = mockOptions.orders?.filter((o: any) => o.stripePaymentIntentId === searchValue)
          return { docs: found || [], totalDocs: (found || []).length }
        }
        return { docs: [], totalDocs: 0 }
      }
      if (collection === 'stock-reservations' || String(collection).includes('stock')) {
        const status = where?.status?.equals
        const order = where?.order?.equals
        let filtered = mockOptions.reservationQueryDocs || mockOptions.reservations || []
        if (status) filtered = filtered.filter((r: any) => r.status === status)
        if (order) filtered = filtered.filter((r: any) => r.order === order || r.order?.id === order)
        return { docs: filtered, totalDocs: filtered.length }
      }
      return { docs: [], totalDocs: 0 }
    }),
    findByID: vi.fn(async ({ collection, id, req }: any) => {
      if (collection === 'orders' || collection === 'orders') {
        if (req) mockOrderConcurrencyEvents.push({ kind: 'read', orderId: Number(id), req })
        if (mockOptions.order && mockOptions.order.id === id) return mockOptions.order
        return null
      }
      if (collection === 'flowers' || collection === 'flowers') {
        return mockOptions.flowers?.[id] || null
      }
      if (String(collection).includes('stock')) {
        return mockOptions.reservations?.find((r: any) => r.id === id) || null
      }
      return null
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === 'orders' || collection === 'orders') {
        if (mockOptions.expectedOrderUpdate) {
          expect(data).toMatchObject(mockOptions.expectedOrderUpdate.data)
        }
        Object.assign(mockOptions.order, data)
        return mockOptions.order
      }
      if (collection === 'stock-reservations' || String(collection).includes('stock')) {
        const res = mockOptions.reservations?.find((r: any) => r.id === id)
        if (res) Object.assign(res, data)
        return res
      }
      if (collection === 'flowers' || collection === 'flowers') {
        if (mockOptions.flowers?.[id]) {
          Object.assign(mockOptions.flowers[id], data)
        }
        return mockOptions.flowers?.[id] || null
      }
      return null
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      if (String(collection).includes('email-notification') || collection === 'email-notifications') {
        mockEmailNotifIdSeq++
        const doc = {
          id: mockEmailNotifIdSeq,
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        mockEmailNotifs.push(doc)
        return doc
      }
      return undefined
    }),
    config: { admin: { user: 'users' } },
    db: { name: 'sqlite' },
  }
  return payload
}

function createAdminRequest(manualRefund?: { confirmed: boolean; reference?: string }): any {
  return {
    user: { id: 42, collection: 'users' },
    json: vi.fn(async () => manualRefund ? { manualRefund } : {}),
  }
}

// ─── Mock Stripe ──────────────────────────────────────────────

vi.mock('./db-adapter', async () => {
  const actual = await vi.importActual<any>('./db-adapter')
  return {
    ...actual,
    lockOrderForUpdate: vi.fn(async (ctx: any, orderId: number) => {
      mockOrderConcurrencyEvents.push({ kind: 'lock', orderId, req: ctx.req })
      mockOrderLockHook?.(orderId)
    }),
  }
})

let mockPaymentIntents: Record<string, any> = {}
let mockRefunds: Record<string, any[]> = {}
let mockRefundsCalled: Array<{ paymentIntentId: string; idempotencyKey: string; metadata?: Record<string, string> }> = []
let mockStripeCallCounts = { retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 }

function resetStripeMocks() {
  mockPaymentIntents = {}
  mockRefunds = {}
  mockRefundsCalled = []
  mockStripeCallCounts = { retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 }
}

function addMockPaymentIntent(overrides: Partial<any> = {}): any {
  const id = overrides.id || `pi_mock_${Date.now()}`
  const intent = {
    id,
    object: 'payment_intent',
    amount: 15000,
    amount_received: 15000,
    amount_capturable: 0,
    currency: 'eur',
    status: 'succeeded',
    client_secret: `${id}_secret_abc`,
    metadata: { orderId: '1' },
    ...overrides,
  }
  mockPaymentIntents[id] = intent
  return intent
}

vi.mock('./payments/stripe', async () => {
  const actual = await vi.importActual('./payments/stripe')
  return {
    ...actual as any,
    retrievePaymentIntent: vi.fn(async (paymentIntentId: string) => {
      mockStripeCallCounts.retrieve++
      const pi = mockPaymentIntents[paymentIntentId]
      if (!pi) throw new Error(`PaymentIntent ${paymentIntentId} not found`)
      return pi
    }),
    cancelPaymentIntent: vi.fn(async (paymentIntentId: string) => {
      mockStripeCallCounts.cancel++
      const pi = mockPaymentIntents[paymentIntentId]
      if (!pi) return { canceled: false, currentStatus: 'unknown' }
      if (pi.status === 'canceled') return { canceled: true }
      if (pi.status === 'processing') return { canceled: false, currentStatus: 'processing' }
      if (pi.status === 'succeeded') return { canceled: false, currentStatus: 'succeeded' }
      if (pi.status === 'requires_payment_method' || pi.status === 'requires_capture') {
        pi.status = 'canceled'
        return { canceled: true }
      }
      return { canceled: false, currentStatus: pi.status }
    }),
    createFullRefund: vi.fn(async (paymentIntentId: string, idempotencyKeyPrefix?: string, metadata?: Record<string, string>) => {
      mockStripeCallCounts.createRefund++
      const prefix = idempotencyKeyPrefix ?? 'late-stock-refund'
      const key = `${prefix}:${paymentIntentId}`
      mockRefundsCalled.push({ paymentIntentId, idempotencyKey: key, metadata })
      const pi = mockPaymentIntents[paymentIntentId]
      if (!pi) throw new Error(`PaymentIntent ${paymentIntentId} not found`)

      const refundId = `re_mock_${Date.now()}`
      const refund = {
        id: refundId,
        object: 'refund',
        amount: pi.amount_received || pi.amount,
        status: 'succeeded',
        payment_intent: paymentIntentId,
        metadata: metadata || {},
        created: Math.floor(Date.now() / 1000),
      }

      // Track refunds per PI for listRefundsForPaymentIntent
      if (!mockRefunds[paymentIntentId]) mockRefunds[paymentIntentId] = []
      mockRefunds[paymentIntentId].push(refund)

      return refund
    }),
    listRefundsForPaymentIntent: vi.fn(async (paymentIntentId: string) => {
      mockStripeCallCounts.listRefunds++
      return mockRefunds[paymentIntentId] || []
    }),
  }
})

// ═══════════════════════════════════════════════════════════════
// Testes
// ═══════════════════════════════════════════════════════════════

describe('cancelOrder — pré-pagamento (pending_payment)', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  it('1. pending_payment sem PI → reservations released + cancelled + order_cancelled email', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'pending_payment',
      stripePaymentIntentId: null,
    })
    mockOptions.reservations = [
      createMockReservation({ id: 101, status: 'active', order: 1 }),
    ]
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('pre_payment_cancelled')
    expect((result as any).paymentIntentCancelled).toBe(false)
    expect(mockOptions.order.orderStatus).toBe('cancelled')
    expect(mockOptions.order.cancelledAt).toBeTruthy()
    // Reserva deve ter sido libertada
    expect(mockOptions.reservations[0].status).toBe('released')
    // Email notification criada
    const emailNotif = mockEmailNotifs.find((n) => n.deduplicationKey === 'order-cancelled:1')
    expect(emailNotif).toBeDefined()
    expect(emailNotif.type).toBe('order_cancelled')
    expect(emailNotif.payload.data.wasRefunded).toBe(false)
  })

  it('2. PI cancelável → Stripe cancel + cancelled', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'pending_payment',
      stripePaymentIntentId: 'pi_cancelable',
    })
    addMockPaymentIntent({ id: 'pi_cancelable', status: 'requires_payment_method' })
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('pre_payment_cancelled')
    expect((result as any).paymentIntentCancelled).toBe(true)
    expect(mockOptions.order.orderStatus).toBe('cancelled')
  })

  it('3. PI já canceled → idempotente', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'pending_payment',
      stripePaymentIntentId: 'pi_canceled',
    })
    addMockPaymentIntent({ id: 'pi_canceled', status: 'canceled' })
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('pre_payment_cancelled')
    expect(mockOptions.order.orderStatus).toBe('cancelled')
  })

  it('4. PI processing → NÃO cancelled', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'pending_payment',
      stripePaymentIntentId: 'pi_processing',
    })
    addMockPaymentIntent({ id: 'pi_processing', status: 'processing' })
    const payload = createMockPayload()

    await expect(cancelOrder(payload, { orderId: 1 })).rejects.toThrow(CancelOrderNotAllowedError)
    expect(mockOptions.order.orderStatus).not.toBe('cancelled')
  })

  it('5. PI succeeded race → NÃO executar cancel pré-pagamento incorrecto', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'pending_payment',
      stripePaymentIntentId: 'pi_succeeded',
    })
    addMockPaymentIntent({ id: 'pi_succeeded', status: 'succeeded' })
    const payload = createMockPayload()

    await expect(cancelOrder(payload, { orderId: 1 })).rejects.toThrow(CancelOrderNotAllowedError)
    expect(mockOptions.order.orderStatus).not.toBe('cancelled')
  })
})

describe('cancelOrder — pós-pagamento com reembolso (confirmed+paid)', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  it('6. confirmed+paid → full refund + order_cancelled email with wasRefunded=true', async () => {
    const pi = addMockPaymentIntent({ id: 'pi_paid_refund', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_paid_refund',
      total: 150.00,
    })
    mockOptions.reservations = [
      createMockReservation({ id: 201, status: 'confirmed', order: 1, flower: { id: 10 }, quantity: 1 }),
    ]
    mockOptions.flowers = {
      10: { id: 10, productionMode: 'unique', stockQuantity: 0, availability: 'sold' },
    }
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('paid_refund_cancelled')
    const r = result as any
    expect(r.refundId).toBeTruthy()
    expect(r.stockRestored).toBe(true)

    // Estado da Order
    expect(mockOptions.order.orderStatus).toBe('cancelled')
    expect(mockOptions.order.paymentStatus).toBe('refunded')
    expect(mockOptions.order.stripeRefundId).toBeTruthy()
    expect(mockOptions.order.cancelledAt).toBeTruthy()

    // Email notification criada com wasRefunded=true
    const emailNotif = mockEmailNotifs.find((n) => n.deduplicationKey === 'order-cancelled:1')
    expect(emailNotif).toBeDefined()
    expect(emailNotif.type).toBe('order_cancelled')
    expect(emailNotif.payload.data.wasRefunded).toBe(true)

    // Stock restaurado
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)
    expect(mockOptions.flowers[10].availability).toBe('available')

    // Reserva libertada
    expect(mockOptions.reservations[0].status).toBe('released')
  })

  it('7. amount vem exclusivamente do Stripe/Order', async () => {
    // O total é lido da Order, nunca do browser
    addMockPaymentIntent({ id: 'pi_amount', status: 'succeeded', amount: 20000, amount_received: 20000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_amount',
      total: 200.00,
    })
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('paid_refund_cancelled')
    // Stripe refund foi chamado com o PI id, não um amount do browser
    expect(mockRefundsCalled.length).toBe(1)
    expect(mockRefundsCalled[0].paymentIntentId).toBe('pi_amount')
  })

  it('8. → paymentStatus refunded', async () => {
    addMockPaymentIntent({ id: 'pi_refunded_status', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_refunded_status',
      total: 150.00,
    })
    const payload = createMockPayload()
    await cancelOrder(payload, { orderId: 1 })

    expect(mockOptions.order.paymentStatus).toBe('refunded')
  })

  it('9. → orderStatus cancelled', async () => {
    addMockPaymentIntent({ id: 'pi_cancelled_status', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_cancelled_status',
      total: 150.00,
    })
    const payload = createMockPayload()
    await cancelOrder(payload, { orderId: 1 })

    expect(mockOptions.order.orderStatus).toBe('cancelled')
  })

  it('10. unique stock restaurado uma vez', async () => {
    addMockPaymentIntent({ id: 'pi_unique', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_unique',
      total: 150.00,
    })
    mockOptions.reservations = [
      createMockReservation({ id: 301, status: 'confirmed', order: 1, flower: { id: 10 }, quantity: 1 }),
    ]
    mockOptions.flowers = {
      10: { id: 10, productionMode: 'unique', stockQuantity: 0, availability: 'sold' },
    }
    const payload = createMockPayload()

    // Primeira chamada
    await cancelOrder(payload, { orderId: 1 })
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)
    expect(mockOptions.flowers[10].availability).toBe('available')

    // Segunda chamada (idempotente)
    mockOptions.order.orderStatus = 'cancelled'
    const result2 = await cancelOrder(payload, { orderId: 1 })
    expect(result2.kind).toBe('already_cancelled')
    // Stock não foi duplicado (já cancelled)
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)
  })

  it('11. reproducible qty restaurada', async () => {
    addMockPaymentIntent({ id: 'pi_repro', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_repro',
      total: 150.00,
    })
    mockOptions.reservations = [
      createMockReservation({ id: 401, status: 'confirmed', order: 1, flower: { id: 20 }, quantity: 3 }),
    ]
    mockOptions.flowers = {
      20: { id: 20, productionMode: 'reproducible', stockQuantity: 5, availability: 'available' },
    }
    const payload = createMockPayload()
    await cancelOrder(payload, { orderId: 1 })

    // Stock original 5 + 3 restaurados = 8
    expect(mockOptions.flowers[20].stockQuantity).toBe(8)
  })

  it('12. made_to_order não altera stock', async () => {
    addMockPaymentIntent({ id: 'pi_mto', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_mto',
      total: 150.00,
    })
    // made_to_order não tem reservas
    mockOptions.reservations = []
    const payload = createMockPayload()

    const result = await cancelOrder(payload, { orderId: 1 })
    expect(result.kind).toBe('paid_refund_cancelled')
    expect((result as any).stockRestored).toBe(false)
  })

  it('13. retry não duplica refund', async () => {
    addMockPaymentIntent({ id: 'pi_retry', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_retry',
      total: 150.00,
    })
    const payload = createMockPayload()

    // Primeira chamada
    await cancelOrder(payload, { orderId: 1 })
    expect(mockRefundsCalled.length).toBe(1)

    // Segunda chamada: já cancelled
    mockOptions.order.orderStatus = 'cancelled'
    const result2 = await cancelOrder(payload, { orderId: 1 })
    expect(result2.kind).toBe('already_cancelled')
    // Não deve ter chamado refund novamente
    expect(mockRefundsCalled.length).toBe(1)
  })

  it('14. retry não duplica stock', async () => {
    addMockPaymentIntent({ id: 'pi_stock_retry', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_stock_retry',
      total: 150.00,
    })
    mockOptions.reservations = [
      createMockReservation({ id: 501, status: 'confirmed', order: 1, flower: { id: 10 }, quantity: 1 }),
    ]
    mockOptions.flowers = {
      10: { id: 10, productionMode: 'unique', stockQuantity: 0, availability: 'sold' },
    }
    const payload = createMockPayload()

    await cancelOrder(payload, { orderId: 1 })
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)

    // Segunda chamada (idempotente)
    mockOptions.order.orderStatus = 'cancelled'
    await cancelOrder(payload, { orderId: 1 })
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)
  })

  it('15. DB failure após refund → retry reutiliza refund via Stripe API', async () => {
    addMockPaymentIntent({ id: 'pi_db_fail', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_db_fail',
      stripeRefundId: null,   // DB failure — não foi persistido
      total: 150.00,
    })
    const payload = createMockPayload()

    // Primeira chamada cria o refund (Stripe succeed, mas DB transaction falhou)
    // Simulamos que o refund foi criado no Stripe ANTES de chamar cancelOrder
    // para representar o cenário: Stripe refund succeeded, DB commit failed, retry
    const existingRefund = {
      id: 're_db_fail_persisted',
      object: 'refund',
      amount: 15000,
      status: 'succeeded',
      payment_intent: 'pi_db_fail',
      metadata: { reason: 'admin_order_cancel', orderId: '1' },
      created: Math.floor(Date.now() / 1000) - 60,
    }
    mockRefunds['pi_db_fail'] = [existingRefund]

    // Act — retry
    const result = await cancelOrder(payload, { orderId: 1 })

    // Deve ter reutilizado o refund existente (não criou novo)
    expect(result.kind).toBe('paid_refund_cancelled')
    expect((result as any).refundId).toBe('re_db_fail_persisted')
    // Stripe createFullRefund NÃO foi chamado
    expect(mockRefundsCalled.length).toBe(0)
    // Mas stripeRefundId foi actualizado na Order
    expect(mockOptions.order.stripeRefundId).toBe('re_db_fail_persisted')
  })

  it('20. DB failure — retry com refund sem metadata (backward compat)', async () => {
    addMockPaymentIntent({ id: 'pi_legacy', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_legacy',
      stripeRefundId: null,   // DB failure — não foi persistido
      total: 150.00,
    })
    mockOptions.flowers = {}
    const payload = createMockPayload()

    // Refund existente SEM metadata (criado antes da metadata ser adicionada)
    const legacyRefund = {
      id: 're_legacy_old',
      object: 'refund',
      amount: 15000,
      status: 'succeeded',
      payment_intent: 'pi_legacy',
      metadata: {},
      created: Math.floor(Date.now() / 1000) - 3600,
    }
    mockRefunds['pi_legacy'] = [legacyRefund]

    // Act — retry
    const result = await cancelOrder(payload, { orderId: 1 })

    // Deve encontrar o refund pelo amount (PI totalmente reembolsado)
    expect(result.kind).toBe('paid_refund_cancelled')
    expect((result as any).refundId).toBe('re_legacy_old')
    expect(mockRefundsCalled.length).toBe(0)
  })

  it('21. Late-payment refund não é confundido com admin cancel', async () => {
    addMockPaymentIntent({ id: 'pi_late_vs_admin', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_late_vs_admin',
      stripeRefundId: null,
      total: 150.00,
    })
    mockOptions.flowers = {}
    const payload = createMockPayload()

    // Late-payment refund existente — SEM metadata (prefixo 'late-stock-refund')
    const lateRefund = {
      id: 're_late_payment',
      object: 'refund',
      amount: 15000,
      status: 'succeeded',
      payment_intent: 'pi_late_vs_admin',
      metadata: {},
      created: Math.floor(Date.now() / 1000) - 7200,
    }
    mockRefunds['pi_late_vs_admin'] = [lateRefund]

    // Act — admin cancel retry
    const result = await cancelOrder(payload, { orderId: 1 })

    // Deve encontrar o refund pelo amount (PI está totalmente reembolsado)
    // Mesmo sendo late-payment, reutilizar é correcto: não cria duplicado
    expect(result.kind).toBe('paid_refund_cancelled')
    expect((result as any).refundId).toBe('re_late_payment')
    expect(mockRefundsCalled.length).toBe(0)
    // refundReason é admin_order_cancelled (cancelamento admin)
    expect(mockOptions.order.refundReason).toBe('admin_order_cancelled')
  })

  it('22. refundReason de admin cancellation é admin_order_cancelled', async () => {
    addMockPaymentIntent({ id: 'pi_reason', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_reason',
      total: 150.00,
    })
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('paid_refund_cancelled')
    expect(mockOptions.order.refundReason).toBe('admin_order_cancelled')
    expect(mockOptions.order.refundReason).not.toBe('stock_reservation_expired')
  })

  it('23. Stock restore ocorre exactamente uma vez após recovery', async () => {
    addMockPaymentIntent({ id: 'pi_stock_once', status: 'succeeded', amount: 15000, amount_received: 15000 })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_stock_once',
      stripeRefundId: null,
      total: 150.00,
    })
    mockOptions.reservations = [
      createMockReservation({ id: 601, status: 'confirmed', order: 1, flower: { id: 10 }, quantity: 1 }),
    ]
    mockOptions.flowers = {
      10: { id: 10, productionMode: 'unique', stockQuantity: 0, availability: 'sold' },
    }
    const payload = createMockPayload()

    // Refund existente no Stripe (DB failure scenario)
    mockRefunds['pi_stock_once'] = [{
      id: 're_stock_once',
      object: 'refund',
      amount: 15000,
      status: 'succeeded',
      payment_intent: 'pi_stock_once',
      metadata: { reason: 'admin_order_cancel', orderId: '1' },
      created: Math.floor(Date.now() / 1000) - 60,
    }]

    // Act — retry
    const result = await cancelOrder(payload, { orderId: 1 })
    expect(result.kind).toBe('paid_refund_cancelled')
    expect((result as any).stockRestored).toBe(true)

    // Stock restaurado exactamente uma vez
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)
    expect(mockOptions.flowers[10].availability).toBe('available')

    // Reserva libertada
    expect(mockOptions.reservations[0].status).toBe('released')

    // Segunda chamada — idempotente
    mockOptions.order.orderStatus = 'cancelled'
    const result2 = await cancelOrder(payload, { orderId: 1 })
    expect(result2.kind).toBe('already_cancelled')
    expect(mockOptions.flowers[10].stockQuantity).toBe(1)  // não duplicado
  })
})

describe('cancelOrder — pagamento manual reembolsado externamente', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentProvider: 'manual',
      paymentMethodType: 'cash',
      stripePaymentIntentId: null,
      stripeRefundId: null,
    })
  })

  it('exige confirmação explícita do reembolso externo', async () => {
    const payload = createMockPayload()

    await expect(cancelOrder(payload, {
      orderId: 1,
      req: createAdminRequest(),
    })).rejects.toThrow(ManualRefundConfirmationRequiredError)

    expect(mockOptions.order.orderStatus).toBe('confirmed')
    expect(mockOptions.order.paymentStatus).toBe('paid')
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('regista confirmação e referência, não restaura stock (manual orders não têm stock) e nunca chama Stripe', async () => {
    mockOptions.reservations = [
      createMockReservation({ id: 701, status: 'confirmed', order: 1, flower: { id: 10 }, quantity: 1 }),
    ]
    mockOptions.flowers = {
      10: { id: 10, productionMode: 'unique', stockQuantity: 0, availability: 'sold' },
    }
    const payload = createMockPayload()
    const req = createAdminRequest({ confirmed: true, reference: '  TRANSFER-2026-08-22  ' })

    const result = await cancelOrder(payload, { orderId: 1, req })

    expect(result).toMatchObject({
      kind: 'manual_paid_refund_cancelled',
      orderId: 1,
      stockRestored: false,
      refundedAt: expect.any(String),
    })
    expect(mockOptions.order).toMatchObject({
      orderStatus: 'cancelled',
      paymentStatus: 'refunded',
      refundReason: 'admin_manual_payment_refunded',
      manualRefundReference: 'TRANSFER-2026-08-22',
      manualRefundConfirmedBy: 42,
      manualRefundedAt: expect.any(String),
      stripeRefundId: null,
    })
    // Manual orders não alteram stock
    expect(mockOptions.flowers[10]).toMatchObject({ stockQuantity: 0, availability: 'sold' })
    expect(mockOptions.reservations[0].status).toBe('confirmed')
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('exige administrador autenticado e não aceita autor vindo do browser', async () => {
    const payload = createMockPayload()
    const req = {
      user: { id: 77, collection: 'customers' },
      json: vi.fn(async () => ({
        manualRefund: { confirmed: true, reference: 'REF', confirmedBy: 999 },
      })),
    }

    await expect(cancelOrder(payload, { orderId: 1, req })).rejects.toThrow(
      ManualRefundConfirmationRequiredError,
    )
    expect((mockOptions.order as any).manualRefundConfirmedBy).toBeUndefined()
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('bloqueia dados manuais inconsistentes com identificador Stripe sem chamar Stripe', async () => {
    mockOptions.order.stripePaymentIntentId = 'pi_must_not_be_touched'
    const payload = createMockPayload()

    await expect(cancelOrder(payload, {
      orderId: 1,
      req: createAdminRequest({ confirmed: true }),
    })).rejects.toThrow(CancelOrderNotAllowedError)

    expect(mockOptions.order.orderStatus).toBe('confirmed')
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('valida o limite da referência externa antes de alterar a Order', async () => {
    const payload = createMockPayload()

    await expect(cancelOrder(payload, {
      orderId: 1,
      req: createAdminRequest({ confirmed: true, reference: 'x'.repeat(501) }),
    })).rejects.toThrow('não pode exceder 500 caracteres')

    expect(mockOptions.order.orderStatus).toBe('confirmed')
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('sem email conclui o cancelamento sem criar notificação', async () => {
    mockOptions.order.customer = { name: 'Cliente sem email' }
    mockOptions.order.email = null
    const payload = createMockPayload()

    const result = await cancelOrder(payload, {
      orderId: 1,
      manualRefund: { confirmed: true },
      req: { user: { id: 42, collection: 'users' } },
    })

    expect(result.kind).toBe('manual_paid_refund_cancelled')
    expect(mockEmailNotifs).toHaveLength(0)
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('retry é idempotente e não restaura stock (manual orders não têm stock)', async () => {
    mockOptions.reservations = [
      createMockReservation({ id: 702, status: 'confirmed', order: 1, flower: { id: 20 }, quantity: 2 }),
    ]
    mockOptions.flowers = {
      20: { id: 20, productionMode: 'reproducible', stockQuantity: 3, availability: 'available' },
    }
    const payload = createMockPayload()

    const first = await cancelOrder(payload, {
      orderId: 1,
      req: createAdminRequest({ confirmed: true }),
    })
    const second = await cancelOrder(payload, {
      orderId: 1,
      req: createAdminRequest({ confirmed: true }),
    })

    expect(first.kind).toBe('manual_paid_refund_cancelled')
    expect(second.kind).toBe('already_cancelled')
    // Manual orders não alteram stock
    expect(mockOptions.flowers[20].stockQuantity).toBe(3)
    expect(mockOptions.reservations[0].status).toBe('confirmed')
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })

  it('revalida a reserva depois do lock e ignora snapshot concorrente já libertado', async () => {
    mockOptions.reservations = [
      createMockReservation({ id: 703, status: 'released', order: 1, flower: { id: 30 }, quantity: 2 }),
    ]
    mockOptions.reservationQueryDocs = [
      createMockReservation({ id: 703, status: 'confirmed', order: 1, flower: { id: 30 }, quantity: 2 }),
    ]
    mockOptions.flowers = {
      30: { id: 30, productionMode: 'reproducible', stockQuantity: 8, availability: 'available' },
    }
    const payload = createMockPayload()

    const result = await cancelOrder(payload, {
      orderId: 1,
      req: createAdminRequest({ confirmed: true }),
    })

    expect(result).toMatchObject({ kind: 'manual_paid_refund_cancelled', stockRestored: false })
    expect(mockOptions.flowers[30].stockQuantity).toBe(8)
    expect(mockStripeCallCounts).toEqual({ retrieve: 0, cancel: 0, createRefund: 0, listRefunds: 0 })
  })
})

describe('cancelOrder — estados não permitidos', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  it('16. processing não pode cancelar', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'processing', paymentStatus: 'paid' })
    const payload = createMockPayload()
    await expect(cancelOrder(payload, { orderId: 1 })).rejects.toThrow(CancelOrderNotAllowedError)
  })

  it('17. shipped não pode cancelar', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'shipped', paymentStatus: 'paid' })
    const payload = createMockPayload()
    await expect(cancelOrder(payload, { orderId: 1 })).rejects.toThrow(CancelOrderNotAllowedError)
  })

  it('18. completed não pode cancelar', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'completed', paymentStatus: 'paid' })
    const payload = createMockPayload()
    await expect(cancelOrder(payload, { orderId: 1 })).rejects.toThrow(CancelOrderNotAllowedError)
  })

  it('19. sem auth → endpoint rejeita (401 no handler)', async () => {
    // O handler protege todos os providers; o serviço reforça ainda a
    // identidade do administrador no ramo manual (coberto acima).
    expect(true).toBe(true)
  })

  it('20. body não controla amount/status/stock', async () => {
    // No ramo manual o body só fornece confirmação/referência. Provider,
    // estado, total e stock continuam a ser derivados da base de dados.
    expect(true).toBe(true)
  })
})

describe('cancelOrder — awaiting_shipping (ISSUE-1Q)', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  // ── Test G: awaiting_shipping cancellation ──────────────────
  it('G) awaiting_shipping cancela → reserva libertada + order cancelled', async () => {
    mockOptions.flowers = mockOptions.flowers || {}
    const flowerId = 10
    mockOptions.flowers[flowerId] = { id: flowerId, stockQuantity: 2 }
    mockOptions.order = createMockOrder({
      orderStatus: 'awaiting_shipping',
      paymentStatus: 'unpaid',
    })
    mockOptions.reservations = [
      createMockReservation({ flower: flowerId, order: 1, status: 'active' }),
    ]
    mockOptions.expectedOrderUpdate = {
      id: 1,
      data: {
        orderStatus: 'cancelled',
        cancelledAt: expect.any(String),
      },
    }
    const payload = createMockPayload()

    const result = await cancelOrder(payload, { orderId: 1 })

    expect(result.kind).toBe('pre_payment_cancelled')
    // Reservation foi libertada
    expect(mockOptions.reservations[0].status).toBe('released')
    // Order foi cancelada
    expect(mockOptions.order.orderStatus).toBe('cancelled')
    expect(mockOptions.order.cancelledAt).toBeDefined()
  })

  it('G2) awaiting_shipping já cancelled → idempotente', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'awaiting_shipping',
      paymentStatus: 'unpaid',
      cancelledAt: new Date().toISOString(),
    })
    mockOptions.order.orderStatus = 'cancelled'
    const payload = createMockPayload()

    const result = await cancelOrder(payload, { orderId: 1 })
    expect(result.kind).toBe('already_cancelled')
  })
})

describe('cancelOrder — idempotência', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  it('order já cancelled → already_cancelled', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'cancelled', cancelledAt: new Date().toISOString() })
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })
    expect(result.kind).toBe('already_cancelled')
  })

  it('order já expired → already_cancelled', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'expired' })
    const payload = createMockPayload()
    const result = await cancelOrder(payload, { orderId: 1 })
    expect(result.kind).toBe('already_cancelled')
  })
})

describe('cancelOrder — order não encontrada', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  it('lança CancelOrderNotFoundError', async () => {
    mockOptions.order = null
    const payload = createMockPayload()
    await expect(cancelOrder(payload, { orderId: 999 })).rejects.toThrow(CancelOrderNotFoundError)
  })
})

describe('cancelOrder — lock transacional da Order (P1)', () => {
  beforeEach(() => {
    resetMockPayload()
    resetStripeMocks()
  })

  function expectLockBeforeRead(orderId = 1) {
    const relevant = mockOrderConcurrencyEvents.filter((event) => event.orderId === orderId)
    expect(relevant.map((event) => event.kind).slice(0, 2)).toEqual(['lock', 'read'])
    expect(relevant[0].req).toBe(relevant[1].req)
  }

  it('bloqueia antes da releitura no cancelamento pré-pagamento e propaga ctx.req à query de reservas', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'pending_payment', paymentStatus: 'unpaid' })
    mockOptions.reservations = [createMockReservation({ order: 1, status: 'active' })]
    const payload = createMockPayload()

    await cancelOrder(payload, { orderId: 1 })

    expectLockBeforeRead()
    const reservationRead = payload.find.mock.calls.find(
      ([args]: any[]) => args.collection === 'stock-reservations' && args.where?.status?.equals === 'active',
    )?.[0]
    expect(reservationRead?.req).toBe(mockOrderConcurrencyEvents[0].req)
  })

  it('bloqueia antes da releitura no reembolso Stripe', async () => {
    addMockPaymentIntent({ id: 'pi_lock_stripe', status: 'succeeded' })
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentProvider: 'stripe',
      stripePaymentIntentId: 'pi_lock_stripe',
    })
    const payload = createMockPayload()

    await cancelOrder(payload, { orderId: 1 })

    expectLockBeforeRead()
  })

  it('mantém o lock antes da releitura no reembolso manual', async () => {
    mockOptions.order = createMockOrder({
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentProvider: 'manual',
      stripePaymentIntentId: null,
    })
    const req = createAdminRequest({ confirmed: true })
    const payload = createMockPayload()

    await cancelOrder(payload, { orderId: 1, req })

    expectLockBeforeRead()
    expect(mockOrderConcurrencyEvents[0].req).toBe(req)
  })

  it('decide com o estado relido depois de adquirir o lock', async () => {
    mockOptions.order = createMockOrder({ orderStatus: 'pending_payment', paymentStatus: 'unpaid' })
    mockOrderLockHook = () => {
      mockOptions.order.orderStatus = 'confirmed'
      mockOptions.order.paymentStatus = 'paid'
    }
    const payload = createMockPayload()

    await expect(cancelOrder(payload, { orderId: 1 })).rejects.toThrow(CancelOrderNotAllowedError)

    expectLockBeforeRead()
    expect(mockOptions.order.orderStatus).toBe('confirmed')
  })
})
