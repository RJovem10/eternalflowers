/**
 * Testes unitários para checkout-finalization.ts — sem Payload real, com mocking.
 *
 * Testa a lógica de finalização de checkout:
 * 1. draft + shipping válido → pending_payment
 * 2. shippingCost gravado
 * 3. total correto
 * 4. checkoutAttemptId server-side criado
 * 5. segunda chamada reutiliza checkoutAttemptId
 * 6. unique cria uma reserva
 * 7. reproducible cria reserva com qty correta
 * 8. made_to_order não cria reserva
 * 9. múltiplos items → reservas corretas
 * 10. stock insuficiente → rollback total
 * 11. paymentStatus continua unpaid
 * 12. reservations.order aponta para Order
 * 13. cupula → reservas criadas + awaiting_shipping
 * 14. cupula não bloqueia stock reservation
 * 15. cupula → shippingCost null
 * 16. cupula → total null
 * 17. large-value standard → pending_payment (not free)
 * 18. discount não altera shipping
 * 19. parcel/provider não são necessários para fixed shipping
 * 20. draft + cupula → checkoutAttemptId criado
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prepareOrderForPayment } from './checkout-finalization'
import { fakeProvider, fakeProviderId } from './shipping/providers/fake'
import type { ShippingParcel, ShippingAddress } from './shipping/shipping-types'
import {
  CheckoutFinalizationError,
  InvalidOrderStateError,
} from './checkout-finalization-types'

// ─── Helpers ──────────────────────────────────────────────────

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const DEFAULT_ORIGIN: ShippingAddress = {
  recipientName: 'Eternal Flowers',
  line1: 'Rua das Flores, 123',
  city: 'Lisboa',
  country: 'PT',
}

const DEFAULT_PARCEL: ShippingParcel = {
  weight: 1.0,
}

function makeInput(overrides: Record<string, any> = {}) {
  return {
    orderId: 0, // placeholder — cada teste especifica o seu
    ...overrides,
  }
}

// Mock flowers store with shipping properties
const mockFlowers: Record<number, any> = {
  1: { id: 1, namePt: 'Rosa Vermelha', price: 25.50, productionMode: 'reproducible', stockQuantity: 10, availability: 'available', shippingClass: 'standard', canShareShippingPackage: false },
  2: { id: 2, namePt: 'Orquídea Azul', price: 45.00, productionMode: 'unique', stockQuantity: 1, availability: 'available', shippingClass: 'standard', canShareShippingPackage: false },
  3: { id: 3, namePt: 'Girassol Made-to-Order', price: 30.00, productionMode: 'made_to_order', stockQuantity: 0, availability: 'available', shippingClass: 'standard', canShareShippingPackage: false },
  4: { id: 4, namePt: 'Tulipa Legacy', price: 15.00, productionMode: undefined, stockQuantity: 5, availability: 'available', shippingClass: 'standard', canShareShippingPackage: false },
  5: { id: 5, namePt: 'Lírio Esgotado', price: 20.00, productionMode: 'reproducible', stockQuantity: 2, availability: 'available', shippingClass: 'standard', canShareShippingPackage: false },
  6: { id: 6, namePt: 'Cúpula de Rosas', price: 80.00, productionMode: 'reproducible', stockQuantity: 3, availability: 'available', shippingClass: 'cupula', canShareShippingPackage: false },
}

interface MockOrder {
  id: number
  orderNumber: string
  orderStatus: string
  paymentStatus: string
  checkoutAttemptId: string | null
  checkoutRequestHash: string
  subtotal: number
  discount: number
  shippingCost: number | null
  total: number | null
  shippingProvider: string | null
  shippingServiceCode: string | null
  shippingServiceName: string | null
  shippingEstimatedMinDays: number | null
  shippingEstimatedMaxDays: number | null
  currency: string
  items: any[]
  shippingAddress: any
  customer: any
  locale: string
  [key: string]: any
}

let mockOrders: MockOrder[] = []
let mockOrderIdSeq = 0
let mockReservationIdSeq = 0
let mockReservations: any[] = []

function resetMocks() {
  mockOrders = []
  mockOrderIdSeq = 0
  mockReservationIdSeq = 0
  mockReservations = []
}

function createDraftOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  mockOrderIdSeq++
  const order: MockOrder = {
    id: mockOrderIdSeq,
    orderNumber: `EF-20260808-${String(mockOrderIdSeq).padStart(4, '0')}`,
    orderStatus: 'draft',
    paymentStatus: 'unpaid',
    checkoutAttemptId: null,
    checkoutRequestHash: uuidv4(),
    subtotal: 0,
    discount: 0,
    shippingCost: null,
    total: null,
    shippingProvider: null,
    shippingServiceCode: null,
    shippingServiceName: null,
    shippingEstimatedMinDays: null,
    shippingEstimatedMaxDays: null,
    currency: 'EUR',
    items: [],
    shippingAddress: {
      recipientName: 'Maria Silva',
      line1: 'Rua das Flores, 123',
      city: 'Lisboa',
      postalCode: '1000-001',
      country: 'PT',
    },
    customer: {
      name: 'Maria Silva',
      email: 'maria@example.com',
      phone: '+351****5678',
    },
    locale: 'pt',
    ...overrides,
  }

  if (order.items.length > 0) {
    order.subtotal = order.items.reduce((acc: number, item: any) => {
      return acc + (Number(item.lineTotal) || 0)
    }, 0)
  }

  mockOrders.push(order)
  return order
}

function makeOrderItem(flowerId: number, qty: number) {
  const flower = mockFlowers[flowerId]
  const price = Number(flower?.price) || 0
  return {
    flower: flowerId,
    name: flower?.namePt || '',
    price,
    qty,
    lineTotal: price * qty,
    productionMode: flower?.productionMode || null,
  }
}

/** Cria um mock Payload com filtro por where nos reservations */
function createMockPayload() {
  const mockFind = vi.fn(async ({ collection, where }: any) => {
    if (collection === 'orders' || collection === 'orders') {
      if (where?.id?.equals) {
        const found = mockOrders.filter((o) => o.id === where.id.equals)
        return { docs: found.slice(0, 10), totalDocs: found.length }
      }
      return { docs: mockOrders, totalDocs: mockOrders.length }
    }
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      let filtered = [...mockReservations]

      if (where?.idempotencyKeyHash?.equals) {
        filtered = filtered.filter((r: any) => r.idempotencyKeyHash === where.idempotencyKeyHash.equals)
      }
      if (where?.flower?.equals !== undefined) {
        filtered = filtered.filter((r: any) => {
          const rFlowerId = typeof r.flower === 'object' ? r.flower.id : r.flower
          return rFlowerId === where.flower.equals
        })
      }
      if (where?.status?.equals) {
        filtered = filtered.filter((r: any) => r.status === where.status.equals)
      }
      if (where?.expiresAt?.greater_than) {
        const threshold = new Date(where.expiresAt.greater_than).getTime()
        filtered = filtered.filter((r: any) => new Date(r.expiresAt).getTime() > threshold)
      }

      return { docs: filtered, totalDocs: filtered.length }
    }
    if (collection === 'coupons') {
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
    return null
  })

  const mockCreate = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'stock-reservations' || collection === 'stock-reservations') {
      mockReservationIdSeq++
      const reservation = {
        id: mockReservationIdSeq,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockReservations.push(reservation)
      return reservation
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

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUIDv4(s: string): boolean {
  return UUID_V4_RE.test(s)
}

// ─── Testes ───────────────────────────────────────────────────

describe('prepareOrderForPayment', () => {
  beforeEach(() => {
    resetMocks()
  })

  // ── Testes standard ────────────────────────────────────────

  it('1. draft + shipping válido → pending_payment', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.kind).toBe('prepared')
    expect(result.order.orderStatus).toBe('pending_payment')
    expect(result.order.paymentStatus).toBe('unpaid')
  })

  it('2. shippingCost gravado (fixed shipping para 2 items non-shareable PT)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // 2 unidades standard non-shareable (default) em PT → 2 × €4 = €8
    expect(result.order.shippingCost).toBe(8.00)
    expect(result.order.shippingProvider).toBe('fixed')
    expect(result.order.shippingServiceCode).toBe('FIXED_STANDARD')
    expect(result.order.shippingServiceName).toBe('Portes Fixos Standard')
    expect(result.order.shippingEstimatedMinDays).toBeNull()
    expect(result.order.shippingEstimatedMaxDays).toBeNull()
  })

  it('3. total correto (subtotal - discount + fixed shipping)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [makeOrderItem(1, 2)], // 25.50 * 2 = 51.00
      discount: 5.10,
    })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // total = 51.00 - 5.10 + 8.00 (2 non-shareable × €4) = 53.90
    expect(Number(result.order.total)).toBeCloseTo(53.90, 2)
  })

  it('4. checkoutAttemptId server-side criado', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.checkoutAttemptId).toBeDefined()
    expect(isValidUUIDv4(result.checkoutAttemptId)).toBe(true)
    expect(result.order.checkoutAttemptId).toBe(result.checkoutAttemptId)
  })

  it('5. segunda chamada reutiliza checkoutAttemptId', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const r1 = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const r2 = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(r2.kind).toBe('already_prepared')
    expect(r2.checkoutAttemptId).toBe(r1.checkoutAttemptId)
  })

  it('6. unique cria uma reserva', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(2, 1)] }) // unique

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(1)

    const uniqueReserve = orderReserves[0]
    const flowerId = typeof uniqueReserve.flower === 'object' ? uniqueReserve.flower.id : uniqueReserve.flower
    expect(flowerId).toBe(2)
    expect(uniqueReserve.quantity).toBe(1)
  })

  it('7. reproducible cria reserva com qty correta', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 3)] }) // reproducible, qty=3

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(1)
    const reproReserve = orderReserves[0] as any
    const flowerId = typeof reproReserve.flower === 'object' ? reproReserve.flower.id : reproReserve.flower
    expect(flowerId).toBe(1)
    expect(reproReserve.quantity).toBe(3)
  })

  it('8. made_to_order não cria reserva', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(3, 1)] }) // made_to_order

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(0)
    expect(result.order.orderStatus).toBe('pending_payment')
  })

  it('9. múltiplos items → reservas corretas', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [
        makeOrderItem(1, 2), // reproducible
        makeOrderItem(2, 1), // unique
        makeOrderItem(3, 1), // made_to_order — não cria reserva
      ],
    })

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(2)

    const reproReserve = orderReserves.find((r: any) => {
      const flowerId = typeof r.flower === 'object' ? r.flower.id : r.flower
      return flowerId === 1
    })
    expect(reproReserve).toBeDefined()
    expect(reproReserve.quantity).toBe(2)

    const uniqueReserve = orderReserves.find((r: any) => {
      const flowerId = typeof r.flower === 'object' ? r.flower.id : r.flower
      return flowerId === 2
    })
    expect(uniqueReserve).toBeDefined()
    expect(uniqueReserve.quantity).toBe(1)
  })

  it('10. stock insuficiente → rollback total (Order continua draft)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(5, 5)] }) // requests 5, stockQuantity=2

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
      }))
    ).rejects.toThrow()

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
    expect(updatedOrder?.total).toBeNull()

    expect(mockReservations.length).toBe(0)
  })

  it('11. paymentStatus continua unpaid', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.order.paymentStatus).toBe('unpaid')
  })

  it('12. reservations.order aponta para Order', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(1)
    expect(orderReserves[0].order).toBe(order.id)
  })

  // ── Testes Cúpula ─────────────────────────────────────────

  it('13. cupula → reservas criadas + awaiting_shipping', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(6, 1)] }) // cupula

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // Stock foi reservado
    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(1)

    // Order em awaiting_shipping
    expect(result.order.orderStatus).toBe('awaiting_shipping')
    expect(result.order.paymentStatus).toBe('unpaid')
    expect(result.checkoutAttemptId).toBeDefined()
  })

  it('14. cupula → shippingCost null e total null', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(6, 1)] }) // cupula

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.order.shippingCost).toBeNull()
    expect(result.order.total).toBeNull()
    expect(result.order.shippingProvider).toBeNull()
    expect(result.order.shippingServiceCode).toBeNull()
    expect(result.order.shippingServiceName).toBeNull()
  })

  it('15. cupula + standard items → awaiting_shipping + stock reservado', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [
        makeOrderItem(6, 1),  // cupula
        makeOrderItem(1, 2),  // standard
      ],
    })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // Stock foi reservado para todos os items
    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(2)

    expect(result.order.orderStatus).toBe('awaiting_shipping')
  })

  it('16. large-value standard → pending_payment (NOT free)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [makeOrderItem(1, 10)], // 10 × 25.50 = 255.00
    })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // Large value still pays shipping
    expect(result.order.orderStatus).toBe('pending_payment')
    // 10 non-shareable items = 10 shipment units × €4 = €40
    expect(result.order.shippingCost).toBe(40.00)
  })

  it('17. discount does NOT change shipping calculation', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [makeOrderItem(1, 2)], // subtotal = 51.00
      discount: 25.50, // 50% discount
    })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // Shipping is based on items, not on discounted total
    expect(result.order.shippingCost).toBe(8.00) // 2 units × €4
    expect(Number(result.order.total)).toBeCloseTo(51.00 - 25.50 + 8.00, 2) // = 33.50
  })

  it('18. parcel/provider não são necessários para fixed shipping', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    // Chamar sem parcel/provider/origin
    const result = await prepareOrderForPayment(payload, {
      orderId: order.id,
    })

    expect(result.kind).toBe('prepared')
    expect(result.order.orderStatus).toBe('pending_payment')
    expect(result.order.shippingCost).toBe(4.00) // 1 non-shareable PT = €4
  })

  // ── Idempotência cupula ──────────────────────────────────

  it('19. segunda chamada cupula → already_prepared', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(6, 1)] })

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const r2 = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(r2.kind).toBe('already_prepared')
    expect(r2.order.orderStatus).toBe('awaiting_shipping')
  })
})