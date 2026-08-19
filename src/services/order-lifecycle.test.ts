/**
 * Testes unitários para order-lifecycle.ts — sem Payload real, com mocking.
 *
 * Testa a lógica de expiração de Orders abandonadas (ISSUE 1L).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { expireAbandonedPendingOrders } from './order-lifecycle'
import type { OrderLifecycleResult } from './order-lifecycle-types'

// ─── Mock Stripe cancel ───────────────────────────────────────
// Necessário ao nível do módulo (antes dos testes) para evitar warning.
let stripeCancelResult: { canceled: true } | { canceled: false; currentStatus: string } = { canceled: true }
let stripeCancelCalled = false

vi.mock('./payments/stripe', () => ({
  cancelPaymentIntent: vi.fn(async (_paymentIntentId: string) => {
    stripeCancelCalled = true
    return stripeCancelResult
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ─── Mock flowers store ───────────────────────────────────────

const mockFlowers: Record<number, any> = {
  1: { id: 1, namePt: 'Rosa Vermelha', price: 25.50, productionMode: 'reproducible', stockQuantity: 10, availability: 'available' },
  2: { id: 2, namePt: 'Orquídea Azul', price: 45.00, productionMode: 'unique', stockQuantity: 1, availability: 'available' },
  3: { id: 3, namePt: 'Girassol MTO', price: 30.00, productionMode: 'made_to_order', stockQuantity: 0, availability: 'available' },
  4: { id: 4, namePt: 'Tulipa Legacy', price: 15.00, productionMode: undefined, stockQuantity: 5, availability: 'available' },
}

// ─── Mock stores ──────────────────────────────────────────────

let mockOrders: any[] = []
let mockReservations: any[] = []
let mockOrderIdSeq = 0
let mockReservationIdSeq = 0

function resetAllMocks() {
  mockOrders = []
  mockReservations = []
  mockOrderIdSeq = 0
  mockReservationIdSeq = 0
  stripeCancelCalled = false
  stripeCancelResult = { canceled: true }
}

/**
 * Cria uma Order base na mock store.
 */
function createMockOrder(overrides: Record<string, any> = {}): any {
  mockOrderIdSeq++
  const order = {
    id: mockOrderIdSeq,
    orderNumber: `EF-2026${String(mockOrderIdSeq).padStart(4, '0')}-TEST`,
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    items: [
      { flower: 1, name: 'Rosa Vermelha', price: 25.50, qty: 2, lineTotal: 51.00, productionMode: 'reproducible' },
    ],
    currency: 'EUR',
    subtotal: 51.00,
    discount: 0,
    shippingCost: 5.00,
    total: 56.00,
    checkoutAttemptId: uuidv4(),
    stripePaymentIntentId: null,
    customer: { name: 'Test', email: 'test@example.com', phone: '+351****5678' },
    shippingAddress: { recipientName: 'Test', line1: 'Rua 1', city: 'Lisboa', country: 'PT' },
    billingSameAsShipping: true,
    locale: 'pt',
    checkoutRequestHash: 'abc123',
    ...overrides,
  }
  mockOrders.push(order)
  return order
}

/**
 * Cria uma reserva na mock store, associada a uma Order.
 */
function createMockReservation(overrides: Record<string, any> = {}): any {
  mockReservationIdSeq++
  const reservation = {
    id: mockReservationIdSeq,
    flower: 1,
    quantity: 2,
    status: 'active',
    idempotencyKeyHash: `hash-${mockReservationIdSeq}`,
    order: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    confirmedAt: null,
    expiredAt: null,
    releasedAt: null,
    ...overrides,
  }
  mockReservations.push(reservation)
  return reservation
}

/**
 * Cria um mock Payload que interage com as stores acima.
 * Suporta find, findByID, create, update para orders e stock-reservations.
 */
function createMockPayload() {
  const mockFind = vi.fn(async ({ collection, where, limit }: any) => {
    // Orders
    if (collection === 'orders') {
      // Filtro complexo: and + nested or
      if (where?.and) {
        // OrderStatus filter: can be direct (pending_payment) or nested or (pending_payment OR awaiting_shipping)
        const statusOr = where.and[0]?.or
        const statusDirect = where.and[0]?.orderStatus?.equals
        const paymentFilter = where.and[1]?.or

        let validStatuses: string[] = []
        if (statusOr) {
          validStatuses = statusOr
            .filter((f: any) => f.orderStatus?.equals)
            .map((f: any) => f.orderStatus.equals)
        } else if (statusDirect) {
          validStatuses = [statusDirect]
        }

        if (validStatuses.length > 0 && paymentFilter) {
          const validPaymentStatuses = paymentFilter
            .filter((f: any) => f.paymentStatus?.equals)
            .map((f: any) => f.paymentStatus.equals)
          return {
            docs: mockOrders.filter(
              (o) => validStatuses.includes(o.orderStatus) && validPaymentStatuses.includes(o.paymentStatus),
            ).slice(0, limit || 100),
            totalDocs: mockOrders.length,
          }
        }
      }
      if (where?.orderNumber?.equals) {
        const found = mockOrders.filter((o) => o.orderNumber === where.orderNumber.equals)
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      if (where?.stripePaymentIntentId?.equals) {
        const found = mockOrders.filter(
          (o) => o.stripePaymentIntentId === where.stripePaymentIntentId.equals,
        )
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      return { docs: [], totalDocs: 0 }
    }

    // Stock reservations
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      if (where?.order?.equals) {
        const found = mockReservations.filter((r) => r.order === where.order.equals)
        return { docs: found.slice(0, limit || 100), totalDocs: found.length }
      }
      if (where?.idempotencyKeyHash?.equals) {
        const found = mockReservations.filter(
          (r) => r.idempotencyKeyHash === where.idempotencyKeyHash.equals,
        )
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      if (where?.status?.equals && where?.expiresAt?.less_than) {
        // expireReservations batch query
        const found = mockReservations.filter(
          (r) => r.status === 'active' && r.expiresAt < where.expiresAt.less_than,
        )
        return { docs: found.slice(0, limit || 100), totalDocs: found.length }
      }
      return { docs: [], totalDocs: 0 }
    }

    return { docs: [], totalDocs: 0 }
  })

  const mockFindByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'orders') {
      return mockOrders.find((o) => o.id === id) || null
    }
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      return mockReservations.find((r) => r.id === id) || null
    }
    if (collection === 'flowers') {
      return mockFlowers[id] || null
    }
    return null
  })

  const mockCreate = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      mockReservationIdSeq++
      const reservation = {
        id: mockReservationIdSeq,
        ...data,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      mockReservations.push(reservation)
      return reservation
    }
    return { id: mockReservationIdSeq }
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
      const idx = mockReservations.findIndex((r) => r.id === id)
      if (idx >= 0) {
        mockReservations[idx] = { ...mockReservations[idx], ...data }
        return mockReservations[idx]
      }
    }
    return null
  })

  const mockPayload = {
    find: mockFind,
    findByID: mockFindByID,
    create: mockCreate,
    update: mockUpdate,
    db: { name: 'sqlite' },
  }

  return mockPayload as any
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('expireAbandonedPendingOrders', () => {
  beforeEach(() => {
    resetAllMocks()

    // Mock cancelPaymentIntent for all tests
    vi.mock('./payments/stripe', () => ({
      cancelPaymentIntent: vi.fn(async (paymentIntentId: string) => {
        stripeCancelCalled = true
        return stripeCancelResult
      }),
    }))
  })

  // ─── 1. pending_payment/unpaid + reservation expirada → Order expired ──
  it('1. pending_payment/unpaid + reservation expirada → Order expired', async () => {
    const payload = createMockPayload()
    const order = createMockOrder()
    const now = new Date('2026-08-09T12:00:00Z')

    // Reservation expirada (status=expired)
    createMockReservation({
      flower: 1,
      order: order.id,
      status: 'expired',
    })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(result.details[0].kind).toBe('expired')

    const expiredOrder = mockOrders.find((o) => o.id === order.id)
    expect(expiredOrder.orderStatus).toBe('expired')
    expect(expiredOrder.paymentStatus).toBe('unpaid')
  })

  // ─── 2. reservation active mas expiresAt <= now → expira ────────────
  it('2. reservation active mas expiresAt <= now → Order expira', async () => {
    const payload = createMockPayload()
    const order = createMockOrder()
    const now = new Date('2026-08-09T12:00:00Z')

    // Reservation active mas já expirada (expiresAt no passado)
    createMockReservation({
      flower: 1,
      order: order.id,
      status: 'active',
      expiresAt: '2026-08-09T11:00:00Z', // 1 hora antes de now
    })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('expired')
  })

  // ─── 3. uma reservation expira → restantes active são released ──────
  it('3. uma reservation expira → restantes active são released', async () => {
    const payload = createMockPayload()
    // Order with 2 items
    const order = createMockOrder({
      items: [
        { flower: 1, name: 'Rosa Vermelha', price: 25.50, qty: 1, lineTotal: 25.50, productionMode: 'reproducible' },
        { flower: 2, name: 'Orquídea Azul', price: 45.00, qty: 1, lineTotal: 45.00, productionMode: 'unique' },
      ],
    })
    const now = new Date('2026-08-09T12:00:00Z')

    // R1: expirada
    createMockReservation({
      id: 1,
      flower: 1,
      order: order.id,
      status: 'expired',
    })
    // R2: active, ainda válida
    createMockReservation({
      id: 2,
      flower: 2,
      order: order.id,
      status: 'active',
      expiresAt: '2026-08-09T13:00:00Z', // > now
    })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    const detail = result.details[0] as Extract<OrderLifecycleResult, { kind: 'expired' }>
    expect(detail.expiredReservationCount).toBeGreaterThanOrEqual(1)
    expect(detail.releasedReservationCount).toBeGreaterThanOrEqual(1)

    // Verificar que a R2 foi released
    const r2 = mockReservations.find((r) => r.id === 2)
    expect(r2.status).toBe('released')
  })

  // ─── 4. múltiplas reservations → cleanup completo ──────────────────
  it('4. múltiplas reservations expiradas → cleanup completo', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({
      items: [
        { flower: 1, name: 'Rosa', price: 25.50, qty: 1, lineTotal: 25.50, productionMode: 'reproducible' },
        { flower: 2, name: 'Orquídea', price: 45.00, qty: 1, lineTotal: 45.00, productionMode: 'unique' },
      ],
    })
    const now = new Date('2026-08-09T12:00:00Z')

    // Ambas expiradas
    createMockReservation({ id: 1, flower: 1, order: order.id, status: 'expired' })
    createMockReservation({ id: 2, flower: 2, order: order.id, status: 'expired' })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('expired')
  })

  // ─── 5. reservation missing para item reservável → Order expira ────
  it('5. reservation missing para item reservável → Order expira', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({
      items: [
        { flower: 1, name: 'Rosa', price: 25.50, qty: 1, lineTotal: 25.50, productionMode: 'reproducible' },
      ],
    })
    const now = new Date('2026-08-09T12:00:00Z')

    // Nenhuma reserva para flowerId=1

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('expired')
  })

  // ─── 6. made_to_order-only → não expira ────────────────────────────
  it('6. made_to_order-only → não expira', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({
      items: [
        { flower: 3, name: 'Girassol MTO', price: 30.00, qty: 1, lineTotal: 30.00, productionMode: 'made_to_order' },
      ],
    })
    const now = new Date('2026-08-09T12:00:00Z')

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.details[0].kind).toBe('skipped_made_to_order_only')
  })

  // ─── 7. mixed order → expira se reservation física inválida ────────
  it('7. mixed order → expira se reservation física inválida', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({
      items: [
        { flower: 1, name: 'Rosa', price: 25.50, qty: 1, lineTotal: 25.50, productionMode: 'reproducible' },
        { flower: 3, name: 'Girassol MTO', price: 30.00, qty: 1, lineTotal: 30.00, productionMode: 'made_to_order' },
      ],
    })
    const now = new Date('2026-08-09T12:00:00Z')

    // R1 expirada (item reservável)
    createMockReservation({ id: 1, flower: 1, order: order.id, status: 'expired' })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('expired')
  })

  // ─── 8. PaymentIntent inexistente → cleanup funciona ────────────────
  it('8. PaymentIntent inexistente → cleanup funciona', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: null })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('expired')
  })

  // ─── 9. PI requires_payment_method → cancel + expire Order ──────────
  it('9. PI requires_payment_method → cancel + expire Order', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_abc123' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: true }

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(stripeCancelCalled).toBe(true)
  })

  // ─── 10. PI requires_action → cancel + expire Order ──────────────────
  it('10. PI requires_action → cancel + expire Order', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_requires_action' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: true }

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(stripeCancelCalled).toBe(true)
  })

  // ─── 11. PI já canceled → cleanup idempotente ────────────────────────
  it('11. PI já canceled → cleanup idempotente', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_canceled' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: true }

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
  })

  // ─── 12. PI processing → Order NÃO expira ─────────────────────────────
  it('12. PI processing → Order NÃO expira', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_processing' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: false, currentStatus: 'processing' }

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(result.details[0].kind).toBe('skipped_pi_processing')
  })

  // ─── 13. PI succeeded → Order NÃO expira pelo lifecycle ───────────────
  it('13. PI succeeded → Order NÃO expira pelo lifecycle', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_succeeded' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: false, currentStatus: 'succeeded' }

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(result.details[0].kind).toBe('skipped_pi_succeeded')
  })

  // ─── 14. race durante cancel que muda para succeeded → NÃO expira ─────
  it('14. race durante cancel → PI succeeded → NÃO expira', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_race' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: false, currentStatus: 'succeeded' }

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(result.details[0].kind).toBe('skipped_pi_succeeded')
  })

  // ─── 15. Order paid/confirmed → untouched ────────────────────────────
  it('15. Order paid/confirmed → untouched', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ orderStatus: 'confirmed', paymentStatus: 'paid' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })

    // Not a candidate — won't be selected by candidate query
    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(0)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('confirmed')
  })

  // ─── 16. Order refunded/expired → untouched ────────────────────────────
  it('16. Order refunded/expired → untouched', async () => {
    const payload = createMockPayload()
    const order1 = createMockOrder({ orderStatus: 'expired', paymentStatus: 'refunded' })
    const order2 = createMockOrder({ orderStatus: 'cancelled', paymentStatus: 'unpaid' })
    const now = new Date('2026-08-09T12:00:00Z')

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(0)
  })

  // ─── 17. paymentStatus pending → untouched ─────────────────────────────
  it('17. paymentStatus pending → untouched', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ paymentStatus: 'pending' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(0)
  })

  // ─── 18. reservation confirmed inesperadamente → skip + diagnóstico ──
  it('18. reservation confirmed inesperadamente → skip + diagnóstico', async () => {
    const payload = createMockPayload()
    const order = createMockOrder()
    const now = new Date('2026-08-09T12:00:00Z')

    // Reserva confirmada — não desfaz stock
    createMockReservation({ flower: 1, order: order.id, status: 'confirmed' })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(result.details[0].kind).toBe('skipped_inconsistent_confirmed_reservation')
  })

  // ─── 19. segunda execução → idempotente ──────────────────────────────
  it('19. segunda execução → idempotente', async () => {
    const payload = createMockPayload()
    const order = createMockOrder()
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })

    // Primeira execução
    const r1 = await expireAbandonedPendingOrders(payload, { now })
    expect(r1.expired).toBe(1)

    // Segunda execução — Order já está expired, não é candidate
    const r2 = await expireAbandonedPendingOrders(payload, { now })
    expect(r2.total).toBe(0)
    expect(r2.expired).toBe(0)
  })

  // ─── 20. falha DB durante cleanup → rollback ─────────────────────────
  it('20. erro em expireReservation → rollback da transação', async () => {
    const payload = createMockPayload()
    const order = createMockOrder()

    // Make findByID fail on second call (inside transaction)
    let callCount = 0
    const origFindByID = payload.findByID
    payload.findByID = vi.fn(async (args: any) => {
      callCount++
      // First call is findByID inside executeOrderExpiry (reload order)
      // Second call is from expireReservation → find reservation
      // Third call is from lockFlowerForUpdate in expireReservation
      if (callCount >= 3) {
        throw new Error('Simulated DB error')
      }
      return origFindByID(args)
    })

    const now = new Date('2026-08-09T12:00:00Z')
    createMockReservation({ flower: 1, order: order.id, status: 'expired' })

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(result.details[0].kind).toBe('error')

    // Order should NOT be expired (rollback)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('pending_payment')
  })

  // ─── 21. Stripe calls ocorrem fora da DB transaction ────────────────
  it('21. Stripe cancel ocorre antes da transaction', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({ stripePaymentIntentId: 'pi_tx_test' })
    const now = new Date('2026-08-09T12:00:00Z')

    createMockReservation({ flower: 1, order: order.id, status: 'expired' })
    stripeCancelResult = { canceled: true }

    // Mock expireReservation to track if it's called
    const { expireReservation } = await import('./stock')
    const spy = vi.spyOn({ expireReservation }, 'expireReservation')

    const result = await expireAbandonedPendingOrders(payload, { now })

    expect(result.expired).toBe(1)
    // stripeCancelCalled is true (called outside transaction)
    expect(stripeCancelCalled).toBe(true)
  })

  // ── Test H: awaiting_shipping expiry ─────────────────────────
  it('H) awaiting_shipping with expired reservation → expires order', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({
      orderStatus: 'awaiting_shipping',
      paymentStatus: 'unpaid',
    })
    const now = new Date('2026-08-09T12:00:00Z')

    // Create an expired reservation (expiresAt in the past)
    createMockReservation({
      flower: 1,
      order: order.id,
      status: 'active',
      expiresAt: new Date('2026-08-07T12:00:00Z').toISOString(), // expired 2 days ago
    })

    const result = await expireAbandonedPendingOrders(payload, { now })

    // Should find and expire the awaiting_shipping order
    expect(result.total).toBe(1)
    expect(result.expired).toBe(1)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('expired')
  })

  it('H2) awaiting_shipping with valid reservation → NOT expired', async () => {
    const payload = createMockPayload()
    const order = createMockOrder({
      orderStatus: 'awaiting_shipping',
      paymentStatus: 'unpaid',
    })
    const now = new Date('2026-08-09T12:00:00Z')

    // Create a valid reservation (expiresAt in the future)
    createMockReservation({
      flower: 1,
      order: order.id,
      status: 'active',
      expiresAt: new Date('2026-08-11T12:00:00Z').toISOString(), // still valid
    })

    const result = await expireAbandonedPendingOrders(payload, { now })

    // Should find the order but NOT expire it (reservation still valid)
    expect(result.total).toBe(1)
    expect(result.expired).toBe(0)
    expect(mockOrders.find((o) => o.id === order.id).orderStatus).toBe('awaiting_shipping')
  })
})