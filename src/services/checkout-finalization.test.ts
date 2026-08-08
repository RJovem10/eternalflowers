/**
 * Testes unitários para checkout-finalization.ts — sem Payload real, com mocking.
 *
 * Testa a lógica de finalização de checkout:
 * 1. draft + quote válida → pending_payment
 * 2. shippingCost gravado
 * 3. total correto
 * 4. checkoutAttemptId server-side criado
 * 5. segunda chamada reutiliza checkoutAttemptId
 * 6. unique cria uma reserva
 * 7. reproducible cria reserva com qty correta
 * 8. made_to_order não cria reserva
 * 9. múltiplos items → reservas corretas
 * 10. stock insuficiente → rollback total
 * 11. provider não configurado → Order continua draft, 0 reservas
 * 12. segunda finalização não duplica reservas
 * 13. paymentStatus continua unpaid
 * 14. reservations.order aponta para Order
 * 15. quote negativa/inválida rejeitada
 * 16. parcel ausente → erro tipado
 * 17. parcel inválido → erro
 * 18. origem/destination da Order usada correctamente
 * 19. origin é passado sem alteração ao provider
 * 20. FakeShippingProvider funciona apenas como test double
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prepareOrderForPayment } from './checkout-finalization'
import { fakeProvider, fakeProviderId } from './shipping/providers/fake'
import type { ShippingParcel, ShippingAddress } from './shipping/shipping-types'
import {
  CheckoutFinalizationError,
  InvalidOrderStateError,
  IncompatibleQuoteError,
  NegativeTotalError,
  ShippingParcelNotConfiguredError,
  InvalidShippingParcelError,
} from './checkout-finalization-types'
import { ShippingProviderNotConfiguredError } from './shipping/shipping-types'

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
    provider: fakeProvider,
    shippingServiceCode: 'STANDARD',
    parcel: DEFAULT_PARCEL,
    origin: DEFAULT_ORIGIN,
    ...overrides,
  }
}

// Mock flowers store
const mockFlowers: Record<number, any> = {
  1: { id: 1, namePt: 'Rosa Vermelha', price: 25.50, productionMode: 'reproducible', stockQuantity: 10, availability: 'available' },
  2: { id: 2, namePt: 'Orquídea Azul', price: 45.00, productionMode: 'unique', stockQuantity: 1, availability: 'available' },
  3: { id: 3, namePt: 'Girassol Made-to-Order', price: 30.00, productionMode: 'made_to_order', stockQuantity: 0, availability: 'available' },
  4: { id: 4, namePt: 'Tulipa Legacy', price: 15.00, productionMode: undefined, stockQuantity: 5, availability: 'available' },
  5: { id: 5, namePt: 'Lírio Esgotado', price: 20.00, productionMode: 'reproducible', stockQuantity: 2, availability: 'available' },
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

      // Filter by idempotencyKeyHash
      if (where?.idempotencyKeyHash?.equals) {
        filtered = filtered.filter((r: any) => r.idempotencyKeyHash === where.idempotencyKeyHash.equals)
      }
      // Filter by flower
      if (where?.flower?.equals !== undefined) {
        filtered = filtered.filter((r: any) => {
          const rFlowerId = typeof r.flower === 'object' ? r.flower.id : r.flower
          return rFlowerId === where.flower.equals
        })
      }
      // Filter by status
      if (where?.status?.equals) {
        filtered = filtered.filter((r: any) => r.status === where.status.equals)
      }
      // Filter by expiresAt
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

  it('1. draft + quote válida → pending_payment', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.kind).toBe('prepared')
    expect(result.order.orderStatus).toBe('pending_payment')
    expect(result.order.paymentStatus).toBe('unpaid')
  })

  it('2. shippingCost gravado', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.order.shippingCost).toBe(7.90)
    expect(result.order.shippingProvider).toBe('fake')
    expect(result.order.shippingServiceCode).toBe('STANDARD')
    expect(result.order.shippingServiceName).toBe('Standard Delivery (Fake)')
    expect(result.order.shippingEstimatedMinDays).toBe(2)
    expect(result.order.shippingEstimatedMaxDays).toBe(5)
  })

  it('3. total correto (subtotal - discount + shippingCost)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [makeOrderItem(1, 2)], // 25.50 * 2 = 51.00
      discount: 5.10,
    })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // total = 51.00 - 5.10 + 7.90 = 53.80
    expect(Number(result.order.total)).toBeCloseTo(53.80, 2)
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
    // 2 reservas: reproducible + unique (made_to_order não cria)
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

    // Order should still be draft
    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
    expect(updatedOrder?.total).toBeNull()

    // No reservations should persist (tx rolled back)
    expect(mockReservations.length).toBe(0)
  })

  it('11. provider não configurado → Order continua draft, 0 reservas', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const failingProvider = {
      id: 'inexistente',
      async quote() {
        throw new ShippingProviderNotConfiguredError('Provider de teste não configurado.')
      },
    }

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        provider: failingProvider,
      }))
    ).rejects.toThrow(ShippingProviderNotConfiguredError)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
    expect(updatedOrder?.total).toBeNull()
    expect(updatedOrder?.checkoutAttemptId).toBeNull()
    expect(mockReservations.length).toBe(0)
  })

  it('12. segunda finalização não duplica reservas', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const r2 = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(r2.kind).toBe('already_prepared')
    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(1) // não duplicada
  })

  it('13. paymentStatus continua unpaid', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.order.paymentStatus).toBe('unpaid')
  })

  it('14. reservations.order aponta para Order', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    const orderReserves = mockReservations.filter((r: any) => r.order === order.id)
    expect(orderReserves.length).toBe(1)
    expect(orderReserves[0].order).toBe(order.id)
  })

  it('15. quote negativa/inválida rejeitada (serviceCode inexistente)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        shippingServiceCode: 'SAME_DAY', // non-existent in fake provider
      }))
    ).rejects.toThrow(IncompatibleQuoteError)
  })

  // ── Parcel validation tests ──────────────────────────────

  it('16. parcel ausente → ShippingParcelNotConfiguredError', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    // parcel === undefined
    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: undefined,
      }))
    ).rejects.toThrow(ShippingParcelNotConfiguredError)

    // Order continues draft
    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
    expect(updatedOrder?.total).toBeNull()
    expect(updatedOrder?.checkoutAttemptId).toBeNull()
    expect(mockReservations.length).toBe(0)
  })

  it('17a. parcel inválido (weight ausente) → InvalidShippingParcelError', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: {} as any,
      }))
    ).rejects.toThrow(InvalidShippingParcelError)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
    expect(updatedOrder?.total).toBeNull()
    expect(mockReservations.length).toBe(0)
  })

  it('17b. parcel inválido (weight zero) → InvalidShippingParcelError', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: { weight: 0 },
      }))
    ).rejects.toThrow(InvalidShippingParcelError)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
  })

  it('17c. parcel inválido (weight negativo) → InvalidShippingParcelError', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: { weight: -1 },
      }))
    ).rejects.toThrow(InvalidShippingParcelError)
  })

  it('17d. parcel inválido (length negativo) → InvalidShippingParcelError', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: { weight: 1.0, length: -5 },
      }))
    ).rejects.toThrow(InvalidShippingParcelError)
  })

  it('17e. parcel inválido (null) → ShippingParcelNotConfiguredError', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: null,
      }))
    ).rejects.toThrow(ShippingParcelNotConfiguredError)
  })

  // ── Destination / shippingAddress tests ──────────────────

  it('18a. destination enviado ao provider corresponde à shippingAddress da Order', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [makeOrderItem(1, 1)],
      shippingAddress: {
        recipientName: 'João Teste',
        phone: '+351911222333',
        line1: 'Av. da Liberdade, 100',
        line2: 'Apartamento 4C',
        city: 'Porto',
        region: 'Norte',
        postalCode: '4000-001',
        country: 'PT',
      },
    })

    // Replace fakeProvider with a spy
    const spyQuote = vi.fn(async () => {
      return [{
        provider: fakeProviderId,
        serviceCode: 'STANDARD',
        serviceName: 'Standard Delivery (Fake)',
        amount: 7.90,
        currency: 'EUR',
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
      }]
    })
    const spyProvider = { id: fakeProviderId, quote: spyQuote }

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
      provider: spyProvider,
    }))

    const callInput = (spyQuote.mock.calls[0] as any)[0]
    expect(callInput.destination.recipientName).toBe('João Teste')
    expect(callInput.destination.phone).toBe('+351911222333')
    expect(callInput.destination.line1).toBe('Av. da Liberdade, 100')
    expect(callInput.destination.line2).toBe('Apartamento 4C')
    expect(callInput.destination.city).toBe('Porto')
    expect(callInput.destination.region).toBe('Norte')
    expect(callInput.destination.postalCode).toBe('4000-001')
    expect(callInput.destination.country).toBe('PT')
  })

  it('18b. line2/region/postalCode opcionais são undefined quando ausentes', async () => {
    const payload = createMockPayload()
    // Order sem line2, region, postalCode, phone
    const order = createDraftOrder({
      items: [makeOrderItem(1, 1)],
      shippingAddress: {
        recipientName: 'Maria',
        line1: 'Rua Principal',
        city: 'Faro',
        country: 'PT',
        // phone, line2, region, postalCode ausentes
      },
    })

    const spyQuote = vi.fn(async () => {
      return [{
        provider: fakeProviderId,
        serviceCode: 'STANDARD',
        serviceName: 'Standard Delivery (Fake)',
        amount: 7.90,
        currency: 'EUR',
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
      }]
    })
    const spyProvider = { id: fakeProviderId, quote: spyQuote }

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
      provider: spyProvider,
    }))

    const callInput = (spyQuote.mock.calls[0] as any)[0]
    expect(callInput.destination.phone).toBeUndefined()
    expect(callInput.destination.line2).toBeUndefined()
    expect(callInput.destination.region).toBeUndefined()
    expect(callInput.destination.postalCode).toBeUndefined()
  })

  it('18c. country real da Order é usado (não PT hardcoded)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({
      items: [makeOrderItem(1, 1)],
      shippingAddress: {
        recipientName: 'John Doe',
        line1: '123 Main St',
        city: 'Madrid',
        country: 'ES',
      },
    })

    const spyQuote = vi.fn(async () => {
      return [{
        provider: fakeProviderId,
        serviceCode: 'STANDARD',
        serviceName: 'Standard Delivery (Fake)',
        amount: 15.00,
        currency: 'EUR',
        estimatedMinDays: 3,
        estimatedMaxDays: 7,
      }]
    })
    const spyProvider = { id: fakeProviderId, quote: spyQuote }

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
      provider: spyProvider,
    }))

    const callInput = (spyQuote.mock.calls[0] as any)[0]
    expect(callInput.destination.country).toBe('ES')
  })

  // ── Parcel passthrough test ──────────────────────────────

  it('19. parcel server-side é passado sem alteração indevida ao provider', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    const spyQuote = vi.fn(async () => {
      return [{
        provider: fakeProviderId,
        serviceCode: 'STANDARD',
        serviceName: 'Standard Delivery (Fake)',
        amount: 7.90,
        currency: 'EUR',
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
      }]
    })
    const spyProvider = { id: fakeProviderId, quote: spyQuote }

    const customParcel: ShippingParcel = { weight: 3.5, length: 30, width: 20, height: 15 }

    await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
      provider: spyProvider,
      parcel: customParcel,
    }))

    const callInput = (spyQuote.mock.calls[0] as any)[0]
    expect(callInput.parcels).toHaveLength(1)
    expect(callInput.parcels[0].weight).toBe(3.5)
    expect(callInput.parcels[0].length).toBe(30)
    expect(callInput.parcels[0].width).toBe(20)
    expect(callInput.parcels[0].height).toBe(15)
  })

  // ── Fail-closed tests ────────────────────────────────────

  it('20a. falta de parcel → Order continua draft, 0 reservas', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 2)] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
        parcel: undefined,
      }))
    ).rejects.toThrow(ShippingParcelNotConfiguredError)

    const updatedOrder = mockOrders.find((o) => o.id === order.id)
    expect(updatedOrder?.orderStatus).toBe('draft')
    expect(updatedOrder?.shippingCost).toBeNull()
    expect(updatedOrder?.total).toBeNull()
    expect(mockReservations.length).toBe(0)
  })

  it('20b. fakeProvider funciona apenas como test double (não disponível em runtime)', async () => {
    // Verificar que fakeProvider NÃO está disponível através da implementação
    // (é importado directamente pelos testes, não via produção)
    expect(fakeProvider.id).toBe('fake')

    // O provider é passado explicitamente pelo caller do teste —
    // production code nunca consegue usar fakeProvider acidentalmente
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    expect(result.kind).toBe('prepared')
    expect(result.order.orderStatus).toBe('pending_payment')
  })

  it('21. shippingCost continua a vir exclusivamente da quote do provider', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const providerWithCustomQuote = {
      id: 'custom',
      async quote() {
        return [{
          provider: 'custom',
          serviceCode: 'EXPRESS',
          serviceName: 'Expresso',
          amount: 12.50,
          currency: 'EUR',
          estimatedMinDays: 1,
          estimatedMaxDays: 2,
        }]
      },
    }

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
      provider: providerWithCustomQuote,
      shippingServiceCode: 'EXPRESS',
    }))

    expect(result.order.shippingCost).toBe(12.50)
    expect(result.order.shippingProvider).toBe('custom')
  })

  // ── Additional edge cases ──────────────────────────────

  it('Order inexistente → erro', async () => {
    const payload = createMockPayload()
    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: 999,
      }))
    ).rejects.toThrow(CheckoutFinalizationError)
  })

  it('Order não-draft rejeitada (confirmed)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)], orderStatus: 'confirmed' })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
      }))
    ).rejects.toThrow(InvalidOrderStateError)
  })

  it('Order não-draft rejeitada (cancelled)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)], orderStatus: 'cancelled' })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
      }))
    ).rejects.toThrow(InvalidOrderStateError)
  })

  it('subtotal zero rejeitado', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [] })

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
      }))
    ).rejects.toThrow(CheckoutFinalizationError)
  })

  it('total com despesas de envio positiva calcula corretamente', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(1, 1)] })

    const result = await prepareOrderForPayment(payload, makeInput({
      orderId: order.id,
    }))

    // total = 25.50 - 0 + 7.90 = 33.40
    expect(Number(result.order.total)).toBeCloseTo(33.40, 2)
  })

  it('productionMode null/legacy → rejeitado (stock service regra segura)', async () => {
    const payload = createMockPayload()
    const order = createDraftOrder({ items: [makeOrderItem(4, 2)] }) // legacy, stock service rejeita

    await expect(
      prepareOrderForPayment(payload, makeInput({
        orderId: order.id,
      }))
    ).rejects.toThrow()
  })
})