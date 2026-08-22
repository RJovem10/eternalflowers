import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareOrderForPayment } from './checkout-finalization'
import type { CreateManualOrderInput, CreateOrderInput } from './order-types'
import { CouponValidationError, OrderValidationError } from './order-types'
import { createManualOrder, createOrder, previewManualOrder } from './orders'

const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'

const flowers: Record<number, any> = {
  1: {
    id: 1,
    namePt: 'Rosa de catálogo',
    price: 25.5,
    productionMode: 'reproducible',
    stockQuantity: 10,
    availability: 'available',
    shippingClass: 'standard',
    canShareShippingPackage: false,
  },
  2: {
    id: 2,
    namePt: 'Peça única',
    price: 80,
    productionMode: 'unique',
    stockQuantity: 1,
    availability: 'available',
    shippingClass: 'standard',
    canShareShippingPackage: false,
  },
  3: {
    id: 3,
    namePt: 'Cúpula',
    price: 120,
    productionMode: 'reproducible',
    stockQuantity: 3,
    availability: 'available',
    shippingClass: 'cupula',
    canShareShippingPackage: false,
  },
}

let orders: any[]
let reservations: any[]
let nextOrderID: number
let nextReservationID: number

function relationID(value: any): number {
  return Number(typeof value === 'object' ? value?.id : value)
}

function createPayload() {
  const find = vi.fn(async ({ collection, where, limit = 10 }: any) => {
    if (collection === 'orders') {
      let docs = [...orders]
      if (where?.checkoutRequestHash?.equals) {
        docs = docs.filter((order) => order.checkoutRequestHash === where.checkoutRequestHash.equals)
      }
      if (where?.email?.equals) {
        docs = docs.filter((order) => order.email === where.email.equals)
      }
      return { docs: docs.slice(0, limit), totalDocs: docs.length }
    }
    if (collection === 'coupons') {
      if (where?.code?.equals === 'FIRST') {
        return {
          docs: [{
            id: 1,
            code: 'FIRST',
            type: 'percent',
            value: 10,
            active: true,
            firstOrderOnly: true,
            usesCount: 0,
            maxUses: 0,
          }],
          totalDocs: 1,
        }
      }
      return { docs: [], totalDocs: 0 }
    }
    if (collection === 'stock-reservations') {
      let docs = [...reservations]
      if (where?.idempotencyKeyHash?.equals) {
        docs = docs.filter((reservation) => (
          reservation.idempotencyKeyHash === where.idempotencyKeyHash.equals
        ))
      }
      if (where?.flower?.equals !== undefined) {
        docs = docs.filter((reservation) => relationID(reservation.flower) === Number(where.flower.equals))
      }
      if (where?.status?.equals) {
        docs = docs.filter((reservation) => reservation.status === where.status.equals)
      }
      if (where?.expiresAt?.greater_than) {
        const after = new Date(where.expiresAt.greater_than).getTime()
        docs = docs.filter((reservation) => new Date(reservation.expiresAt).getTime() > after)
      }
      return { docs: docs.slice(0, limit), totalDocs: docs.length }
    }
    return { docs: [], totalDocs: 0 }
  })

  const findByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'flowers') return flowers[Number(id)] || null
    if (collection === 'orders') return orders.find((order) => order.id === Number(id)) || null
    if (collection === 'stock-reservations') {
      return reservations.find((reservation) => reservation.id === Number(id)) || null
    }
    return null
  })

  const create = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'orders') {
      const order = { id: ++nextOrderID, ...data }
      orders.push(order)
      return order
    }
    if (collection === 'stock-reservations') {
      const reservation = { id: ++nextReservationID, ...data }
      reservations.push(reservation)
      return reservation
    }
    throw new Error(`Unexpected create collection: ${collection}`)
  })

  const update = vi.fn(async ({ collection, id, data }: any) => {
    const store = collection === 'orders' ? orders : reservations
    const index = store.findIndex((doc) => doc.id === Number(id))
    if (index < 0) throw new Error(`${collection} ${id} not found`)
    store[index] = { ...store[index], ...data }
    return store[index]
  })

  return {
    find,
    findByID,
    create,
    update,
    db: { name: 'sqlite' },
  } as any
}

function manualInput(overrides: Record<string, any> = {}): CreateManualOrderInput {
  return {
    checkoutRequestId: REQUEST_ID,
    salesChannel: 'whatsapp',
    customer: {
      name: 'Maria Silva',
      phone: '+351 912 345 678',
    },
    shippingAddress: {
      recipientName: 'Maria Silva',
      line1: 'Rua das Flores, 1',
      city: 'Lisboa',
      postalCode: '1000-001',
      country: 'PT',
    },
    billingSameAsShipping: true,
    items: [{ name: "Orquídea", qty: 2, price: 35 }],
    locale: 'pt',
    internalNote: 'Pedido recebido no WhatsApp.',
    ...overrides,
  }
}

function websiteInput(overrides: Record<string, any> = {}): CreateOrderInput {
  return {
    checkoutRequestId: REQUEST_ID,
    customer: {
      name: 'Cliente web',
      email: 'cliente@example.com',
      phone: '+351 911 111 111',
    },
    shippingAddress: {
      recipientName: 'Cliente web',
      line1: 'Avenida Central, 2',
      city: 'Porto',
      postalCode: '4000-001',
      country: 'PT',
    },
    billingSameAsShipping: true,
    items: [{ flowerId: 1, qty: 1 }],
    locale: 'pt',
    ...overrides,
  }
}

describe('manual order domain flow', () => {
  beforeEach(() => {
    orders = []
    reservations = []
    nextOrderID = 0
    nextReservationID = 0
  })

  it('A/B: public checkout still requires email and retains website defaults', async () => {
    const payload = createPayload()

    await expect(createOrder(payload, websiteInput({
      customer: { name: 'Sem email', email: '', phone: '+351 911 111 111' },
    }))).rejects.toThrow(OrderValidationError)

    const result = await createOrder(payload, websiteInput())
    expect(result.order).toMatchObject({
      orderSource: 'website',
      paymentProvider: 'stripe',
      paymentStatus: 'unpaid',
      orderStatus: 'draft',
      email: 'cliente@example.com',
    })
  })

  it('C: accepts a manual order without email without weakening the legacy column', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput())

    expect(result.order.customer.email).toBeNull()
    expect(result.order.email).toBe('')
    expect(result.order).toMatchObject({
      orderSource: 'manual',
      salesChannel: 'whatsapp',
      internalNote: 'Pedido recebido no WhatsApp.',
      paymentProvider: null,
      paymentStatus: 'unpaid',
      orderStatus: 'draft',
    })
  })

  it('D: accepts and normalizes an optional manual-order email', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput({
      customer: {
        name: 'Maria Silva',
        phone: '+351 912 345 678',
        email: '  MARIA@Example.COM ',
      },
    }))

    expect(result.order.customer.email).toBe('maria@example.com')
    expect(result.order.email).toBe('maria@example.com')
  })

  it('E: ignores browser prices, totals and statuses and uses the database flower snapshot', async () => {
    const payload = createPayload()
    const malicious = manualInput({
      items: [{
        flowerId: 1,
        qty: 2,
        price: 0.01,
        name: 'Produto forjado',
        lineTotal: 0.02,
      }],
      subtotal: 0.02,
      discount: 9999,
      shippingCost: 0,
      total: 0.01,
      orderStatus: 'completed',
      paymentStatus: 'paid',
      paymentProvider: 'manual',
      paidAt: '2000-01-01T00:00:00.000Z',
    } as any)

    const result = await createManualOrder(payload, malicious)
    expect(result.order.items).toEqual([expect.objectContaining({
      flower: 1,
      name: 'Rosa de catálogo',
      price: 25.5,
      qty: 2,
      lineTotal: 51,
    })])
    expect(result.order).toMatchObject({
      subtotal: 51,
      discount: 0,
      shippingCost: null,
      total: null,
      orderStatus: 'draft',
      paymentStatus: 'unpaid',
      paymentProvider: null,
    })
    expect(result.order).not.toHaveProperty('paidAt')
  })

  it('E/H: aggregates duplicate product rows before calculating and reserving stock', async () => {
    const payload = createPayload()
    const created = await createManualOrder(payload, manualInput({
      items: [{ flowerId: 1, qty: 1 }, { flowerId: 1, qty: 2 }],
    }))

    expect(created.order.items).toHaveLength(1)
    expect(created.order.items[0]).toMatchObject({ flower: 1, qty: 3, lineTotal: 76.5 })

    const prepared = await prepareOrderForPayment(payload, { orderId: created.order.id })
    expect(prepared.order.orderStatus).toBe('pending_payment')
    expect(reservations).toHaveLength(1)
    expect(reservations[0]).toMatchObject({ flower: 1, quantity: 3, status: 'active', order: created.order.id })
  })

  it('F: previews and prepares standard shipping with the shared fixed-shipping rules', async () => {
    const payload = createPayload()
    const input = manualInput({ items: [{ flowerId: 1, qty: 2 }] })

    const preview = await previewManualOrder(payload, input)
    expect(preview).toMatchObject({
      subtotal: 51,
      discount: 0,
      shippingCost: 8,
      total: 59,
      orderStatus: 'pending_payment',
    })

    const created = await createManualOrder(payload, input)
    const prepared = await prepareOrderForPayment(payload, { orderId: created.order.id })
    expect(prepared.order).toMatchObject({
      shippingCost: 8,
      total: 59,
      shippingProvider: 'fixed',
      orderStatus: 'pending_payment',
      paymentStatus: 'unpaid',
    })
  })

  it('G: cúpula is reserved but remains awaiting_shipping with no payable total', async () => {
    const payload = createPayload()
    const input = manualInput({ items: [{ flowerId: 3, qty: 1 }] })

    const preview = await previewManualOrder(payload, input)
    expect(preview).toMatchObject({
      subtotal: 120,
      shippingCost: null,
      total: null,
      orderStatus: 'awaiting_shipping',
    })

    const created = await createManualOrder(payload, input)
    const prepared = await prepareOrderForPayment(payload, { orderId: created.order.id })
    expect(prepared.order).toMatchObject({
      shippingCost: null,
      total: null,
      paymentProvider: null,
      paymentStatus: 'unpaid',
      orderStatus: 'awaiting_shipping',
    })
    expect(reservations).toHaveLength(1)
    expect(new Date(reservations[0].expiresAt).getTime()).toBeGreaterThan(Date.now() + 47 * 60 * 60 * 1000)
  })

  it('H: unique product cannot reserve more than one unit', async () => {
    const payload = createPayload()
    const created = await createManualOrder(payload, manualInput({
      items: [{ flowerId: 2, qty: 2 }],
    }))

    await expect(prepareOrderForPayment(payload, { orderId: created.order.id }))
      .rejects.toThrow(/unique só aceita quantity=1/)
    expect(reservations).toHaveLength(0)
  })

  it('rejects first-order-only coupons safely when a manual order has no email', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({ coupon: 'FIRST' })))
      .rejects.toThrow(CouponValidationError)
  })

  it('Q: namespaces manual idempotency separately from existing website orders', async () => {
    const payload = createPayload()
    const website = await createOrder(payload, websiteInput())
    const manual = await createManualOrder(payload, manualInput())

    expect(website.order.id).not.toBe(manual.order.id)
    expect(website.order.orderSource).toBe('website')
    expect(manual.order.orderSource).toBe('manual')
    expect(website.order.checkoutRequestHash).not.toBe(manual.order.checkoutRequestHash)
  })
})
