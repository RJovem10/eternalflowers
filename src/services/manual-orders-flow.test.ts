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
        docs = docs.filter((reservation) => Number(reservation.flower) === Number(where.flower.equals))
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
    items: [{ name: 'Orquídea', qty: 2, price: 35 }],
    locale: 'pt',
    shipping: { amount: 8, needsConfirmation: false },
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

  // ────────────────────────────────────────────────────────────────
  //  A/B — Website (createOrder)
  // ────────────────────────────────────────────────────────────────

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

  it('website order rejects invalid locale', async () => {
    const payload = createPayload()
    await expect(createOrder(payload, websiteInput({ locale: 'zz' })))
      .rejects.toThrow(OrderValidationError)
  })

  it('website order rejects invalid country', async () => {
    const payload = createPayload()
    await expect(createOrder(payload, websiteInput({
      shippingAddress: {
        recipientName: 'Fora UE',
        line1: 'Via Roma, 1',
        city: 'Roma',
        postalCode: '00100',
        country: 'XX',
      },
    }))).rejects.toThrow(OrderValidationError)
  })

  // ────────────────────────────────────────────────────────────────
  //  C–E — Manual order creation (createManualOrder)
  // ────────────────────────────────────────────────────────────────

  it('C: accepts a manual order without email without weakening the legacy column', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput())

    expect(result.order.customer.email).toBeNull()
    expect(result.order.email).toBe('')
    expect(result.order).toMatchObject({
      orderSource: 'manual',
      salesChannel: 'whatsapp',
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

  it('E: manual order uses free-item name/qty/price directly, items have flower=null', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 35 }],
    }))

    expect(result.order.items).toHaveLength(1)
    expect(result.order.items[0]).toMatchObject({
      flower: null,
      name: 'Orquídea',
      qty: 2,
      price: 35,
      lineTotal: 70,
    })
    expect(result.order).toMatchObject({
      subtotal: 70,
      discount: 0,
      shippingCost: null,
      total: null,
      orderStatus: 'draft',
      paymentStatus: 'unpaid',
      paymentProvider: null,
    })
  })

  it('E-bis: aggregates duplicate manual items by name+price', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput({
      items: [
        { name: 'Orquídea', qty: 1, price: 35 },
        { name: 'Orquídea', qty: 3, price: 35 },
      ],
    }))

    expect(result.order.items).toHaveLength(1)
    expect(result.order.items[0]).toMatchObject({
      flower: null,
      name: 'Orquídea',
      qty: 4,
      price: 35,
      lineTotal: 140,
    })
  })

  it('E-ter: different manual item names are kept separate', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput({
      items: [
        { name: 'Orquídea', qty: 1, price: 35 },
        { name: 'Ramo personalizado', qty: 1, price: 50 },
      ],
    }))

    expect(result.order.items).toHaveLength(2)
    expect(result.order.items[0]).toMatchObject({ name: 'Orquídea', qty: 1, price: 35 })
    expect(result.order.items[1]).toMatchObject({ name: 'Ramo personalizado', qty: 1, price: 50 })
  })

  // ────────────────────────────────────────────────────────────────
  //  F–G — Manual order preview (previewManualOrder)
  // ────────────────────────────────────────────────────────────────

  it('F: preview manual order with shipping amount — pending_payment', async () => {
    const payload = createPayload()
    const preview = await previewManualOrder(payload, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 35 }],
      shipping: { amount: 8, needsConfirmation: false },
    }))

    expect(preview).toMatchObject({
      items: [{ name: 'Orquídea', qty: 2, price: 35, lineTotal: 70 }],
      subtotal: 70,
      discount: 0,
      shippingCost: 8,
      total: 78,
      orderStatus: 'pending_payment',
    })
  })

  it('F-bis: preview with 0 shipping amount — free shipping, pending_payment', async () => {
    const payload = createPayload()
    const preview = await previewManualOrder(payload, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 35 }],
      shipping: { amount: 0, needsConfirmation: false },
    }))

    expect(preview).toMatchObject({
      subtotal: 70,
      discount: 0,
      shippingCost: 0,
      total: 70,
      orderStatus: 'pending_payment',
    })
  })

  it('G: preview manual order with needsConfirmation — awaiting_shipping', async () => {
    const payload = createPayload()
    const preview = await previewManualOrder(payload, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 35 }],
      shipping: { needsConfirmation: true },
    }))

    expect(preview).toMatchObject({
      items: [{ name: 'Orquídea', qty: 2, price: 35, lineTotal: 70 }],
      subtotal: 70,
      discount: 0,
      shippingCost: null,
      total: null,
      orderStatus: 'awaiting_shipping',
    })
  })

  // ────────────────────────────────────────────────────────────────
  //  H–J — Manual order validation errors
  // ────────────────────────────────────────────────────────────────

  it('H: manual order rejects missing shipping field', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({ shipping: undefined })))
      .rejects.toThrow(OrderValidationError)
  })

  it('I: manual order rejects invalid salesChannel', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({ salesChannel: 'telegram' } as any)))
      .rejects.toThrow(OrderValidationError)
  })

  it('J: manual order rejects first-order-only coupon when no email', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({ coupon: 'FIRST' })))
      .rejects.toThrow(CouponValidationError)
  })

  it('J-bis: manual order with email can use first-order coupon', async () => {
    const payload = createPayload()
    const result = await createManualOrder(payload, manualInput({
      customer: {
        name: 'Maria Silva',
        phone: '+351 912 345 678',
        email: 'maria@example.com',
      },
      coupon: 'FIRST',
    }))

    expect(result.order.coupon).toBe('FIRST')
    // 10% de 70 = 7
    expect(result.order.discount).toBe(7)
  })

  // ────────────────────────────────────────────────────────────────
  //  K — Manual order validation: negative price / empty name
  // ────────────────────────────────────────────────────────────────

  it('K: manual order rejects item with negative price', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({
      items: [{ name: 'Item mau', qty: 1, price: -5 }],
    }))).rejects.toThrow(/preço inválido|negativo/i)
  })

  it('K-bis: manual order rejects item with empty name', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({
      items: [{ name: '  ', qty: 1, price: 10 }],
    }))).rejects.toThrow(OrderValidationError)
  })

  // ────────────────────────────────────────────────────────────────
  //  L — Manual order validation: shipping amount must be >= 0
  // ────────────────────────────────────────────────────────────────

  it('L: manual order rejects negative shipping amount', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({
      shipping: { amount: -5, needsConfirmation: false },
    }))).rejects.toThrow(OrderValidationError)
  })

  it('L-bis: manual order rejects missing amount when needsConfirmation=false', async () => {
    const payload = createPayload()
    await expect(createManualOrder(payload, manualInput({
      shipping: { needsConfirmation: false },
    } as any))).rejects.toThrow(OrderValidationError)
  })

  // ────────────────────────────────────────────────────────────────
  //  M — Manual order idempotency
  // ────────────────────────────────────────────────────────────────

  it('M: namespaces manual idempotency separately from existing website orders', async () => {
    const payload = createPayload()
    const website = await createOrder(payload, websiteInput())
    const manual = await createManualOrder(payload, manualInput())

    expect(website.order.id).not.toBe(manual.order.id)
    expect(website.order.orderSource).toBe('website')
    expect(manual.order.orderSource).toBe('manual')
    expect(website.order.checkoutRequestHash).not.toBe(manual.order.checkoutRequestHash)
  })

  it('M-bis: same manual checkoutRequestId returns existing order (idempotency)', async () => {
    const payload = createPayload()
    const first = await createManualOrder(payload, manualInput())
    const second = await createManualOrder(payload, manualInput())

    expect(second.order.id).toBe(first.order.id)
  })

  // ────────────────────────────────────────────────────────────────
  //  N — Manual order: prepareOrderForPayment does NOT reserve stock
  // ────────────────────────────────────────────────────────────────

  it('N: prepareOrderForPayment for manual order skips stock reservations', async () => {
    const payload = createPayload()
    const created = await createManualOrder(payload, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 35 }],
      shipping: { amount: 8, needsConfirmation: false },
    }))

    // Order created with null total/shipping — draft
    expect(created.order.orderStatus).toBe('draft')
    expect(created.order.total).toBeNull()

    // prepareOrderForPayment: hasTotal=false → stays draft (no stock reservations)
    const prepared = await prepareOrderForPayment(payload, { orderId: created.order.id })
    expect(prepared.order.orderStatus).toBe('draft')
    expect(reservations).toHaveLength(0)
  })

  it('N-bis: manual order with total set transitions to pending_payment on prepare', async () => {
    const payload = createPayload()
    const created = await createManualOrder(payload, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 35 }],
      shipping: { amount: 8, needsConfirmation: false },
    }))

    // Simulate an admin setting the shipping and total on the order
    // (the admin endpoint would do this before prepareOrderForPayment)
    await payload.update({
      collection: 'orders',
      id: created.order.id,
      data: { shippingCost: 8, total: 78 },
    })

    const prepared = await prepareOrderForPayment(payload, { orderId: created.order.id })
    expect(prepared.order.orderStatus).toBe('pending_payment')
    expect(prepared.kind).toBe('prepared')
    expect(reservations).toHaveLength(0)
  })

  // ────────────────────────────────────────────────────────────────
  //  O — Manual order Coupon with discount
  // ────────────────────────────────────────────────────────────────

  it('O: manual order applies coupon discount to subtotal', async () => {
    const payload = createPayload()
    // Use a valid coupon code — we need one that doesn't require firstOrderOnly
    // Patch the mock to return a non-firstOrder coupon
    const find = vi.fn(async ({ collection, where }: any) => {
      if (collection === 'orders') return { docs: [], totalDocs: 0 }
      if (collection === 'coupons') {
        if (where?.code?.equals === 'PCT10') {
          return {
            docs: [{
              id: 2,
              code: 'PCT10',
              type: 'percent',
              value: 10,
              active: true,
              firstOrderOnly: false,
              usesCount: 0,
              maxUses: 0,
            }],
            totalDocs: 1,
          }
        }
        return { docs: [], totalDocs: 0 }
      }
      if (collection === 'stock-reservations') return { docs: [], totalDocs: 0 }
      return { docs: [], totalDocs: 0 }
    })

    const payload2 = { ...createPayload(), find }
    const result = await createManualOrder(payload2, manualInput({
      items: [{ name: 'Orquídea', qty: 2, price: 50 }],
      coupon: 'PCT10',
    }))

    // subtotal = 100, 10% discount = 10
    expect(result.order.subtotal).toBe(100)
    expect(result.order.discount).toBe(10)
    expect(result.order.coupon).toBe('PCT10')
  })
})