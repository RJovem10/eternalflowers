/**
 * Testes unitários para orders.ts — sem Payload real, com mocking.
 *
 * Testa a lógica de validação e transformação isoladamente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrder } from './orders'
import type { CreateOrderInput } from './order-types'
import {
  OrderValidationError,
  InvalidProductError,
  CouponValidationError,
  IdempotencyConflictError,
} from './order-types'

// ─── Helpers ──────────────────────────────────────────────────

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function makeValidInput(flowerIds: number[], overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    checkoutRequestId: uuidv4(),
    customer: {
      name: 'Maria Silva',
      email: 'maria@example.com',
      phone: '+351912345678',
    },
    shippingAddress: {
      recipientName: 'Maria Silva',
      line1: 'Rua das Flores, 123',
      city: 'Lisboa',
      postalCode: '1000-001',
      country: 'PT',
    },
    billingSameAsShipping: true,
    items: flowerIds.map((id) => ({ flowerId: id, qty: 2 })),
    locale: 'pt',
    ...overrides,
  }
}

// Mock flowers store
const mockFlowers: Record<number, any> = {
  1: {
    id: 1,
    namePt: 'Rosa Vermelha',
    nameEn: 'Red Rose',
    price: 25.50,
    productionMode: 'reproducible',
    stockQuantity: 10,
    availability: 'available',
  },
  2: {
    id: 2,
    namePt: 'Orquídea Azul',
    nameEn: 'Blue Orchid',
    price: 45.00,
    productionMode: 'unique',
    stockQuantity: 1,
    availability: 'available',
  },
  3: {
    id: 3,
    namePt: 'Girassol Legacy',
    price: 10.00,
    productionMode: undefined,
    stockQuantity: 5,
    availability: 'available',
  },
}

// Mock orders store
let mockOrders: any[] = []
let mockOrderIdSeq = 0

function resetMocks() {
  mockOrders = []
  mockOrderIdSeq = 0
}

function createMockPayload() {
  const mockFind = vi.fn(async ({ collection, where, limit }: any) => {
    if (collection === 'orders') {
      const hash = where?.checkoutRequestHash?.equals
      if (hash) {
        const found = mockOrders.filter((o) => o.checkoutRequestHash === hash)
        return { docs: found.slice(0, limit || 10), totalDocs: found.length }
      }
      return { docs: [], totalDocs: 0 }
    }
    if (collection === 'coupons') {
      const code = where?.code?.equals
      if (code && code === 'TEST10') {
        return { docs: [{ id: 1, code: 'TEST10', type: 'percent', value: 10, active: true, usesCount: 0, minOrder: 20, maxUses: 0 }], totalDocs: 1 }
      }
    }
    return { docs: [], totalDocs: 0 }
  })

  const mockFindByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'flowers') {
      return mockFlowers[id] || null
    }
    if (collection === 'coupons') {
      return { id: 1, code: 'TEST10', type: 'percent', value: 10, active: true, usesCount: 0, minOrder: 20, maxUses: 0 }
    }
    return null
  })

  const mockCreate = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'orders') {
      mockOrderIdSeq++
      const order = {
        id: mockOrderIdSeq,
        ...data,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      mockOrders.push(order)
      return order
    }
    return { id: mockOrderIdSeq }
  })

  const mockPayload = {
    find: mockFind,
    findByID: mockFindByID,
    create: mockCreate,
    db: { name: 'sqlite' },
  }

  return mockPayload as any
}

describe('createOrder (unit tests with mocked Payload)', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('1. cria uma order válida', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1]))
    expect(result.order).toBeDefined()
    expect(result.order.id).toBeGreaterThan(0)
    expect(result.order.orderNumber).toMatch(/^EF-\d{8}-[0-9A-F]{8}$/)
    expect(result.order.orderStatus).toBe('draft')
    expect(result.order.paymentStatus).toBe('unpaid')
    expect(result.order.currency).toBe('EUR')
    expect(result.order.locale).toBe('pt')
  })

  it('2. preço vem da Flower', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1], {
      items: [{ flowerId: 1, qty: 3 }],
    }))
    const item = result.order.items[0]
    expect(item.price).toBe(25.50)
    expect(item.name).toBe('Rosa Vermelha')
    expect(item.flower).toBe(1)
  })

  it('3. subtotal correcto com vários items', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1, 2]))
    expect(result.order.items[0].lineTotal).toBe(51.00)
    expect(result.order.items[1].lineTotal).toBe(90.00) // 45 * 2
    expect(result.order.subtotal).toBe(141.00)
  })

  it('4. qty inválida rejeitada', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], {
      items: [{ flowerId: 1, qty: 0 }],
    }))).rejects.toThrow(OrderValidationError)
  })

  it('4b. qty negativa rejeitada', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], {
      items: [{ flowerId: 1, qty: -1 }],
    }))).rejects.toThrow(OrderValidationError)
  })

  it('5. flower inexistente rejeitada', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([999]))).rejects.toThrow(InvalidProductError)
  })

  it('6. email vazio rejeitado', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], {
      customer: { name: 'Test', email: '', phone: '+351912345678' },
    }))).rejects.toThrow(OrderValidationError)
  })

  it('6b. phone vazio rejeitado', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], {
      customer: { name: 'Test', email: 'test@example.com', phone: '' },
    }))).rejects.toThrow(OrderValidationError)
  })

  it('7. coupon válido calcula discount', async () => {
    const payload = createMockPayload()
    // 2 x Rosa Vermelha (25.50) = 51.00, 10% = 5.10
    const result = await createOrder(payload, makeValidInput([1], { coupon: 'TEST10' }))
    expect(result.order.discount).toBe(5.10)
    expect(result.order.coupon).toBe('TEST10')
  })

  it('7b. coupon inválido rejeitado', async () => {
    const payload = createMockPayload()
    // The mock find already returns { docs: [] } for non-TEST10 codes
    await expect(createOrder(payload, makeValidInput([1], {
      coupon: 'INVALIDO',
    }))).rejects.toThrow(CouponValidationError)
  })

  it('8. coupon NÃO incrementa usesCount', async () => {
    const payload = createMockPayload()
    await createOrder(payload, makeValidInput([1], { coupon: 'TEST10' }))
    // The mock payload.create is only called for orders, not coupons
    // Verify payload.create was NOT called with 'coupons'
    const createCalls = (payload.create as any).mock.calls
    const couponCreates = createCalls.filter((c: any[]) => c[0]?.collection === 'coupons')
    expect(couponCreates.length).toBe(0)
  })

  it('9. productionMode snapshot', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1, 3], {
      items: [
        { flowerId: 1, qty: 1 }, // reproducible
        { flowerId: 3, qty: 1 }, // null (legacy)
      ],
    }))
    const repro = result.order.items.find((i: any) => i.flower === 1)
    const legacy = result.order.items.find((i: any) => i.flower === 3)
    expect(repro.productionMode).toBe('reproducible')
    expect(legacy.productionMode).toBeNull()
  })

  it('10. shippingCost e total são null', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1]))
    expect(result.order.shippingCost).toBeNull()
    expect(result.order.total).toBeNull()
  })

  it('11. orderStatus=draft e paymentStatus=unpaid', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1]))
    expect(result.order.orderStatus).toBe('draft')
    expect(result.order.paymentStatus).toBe('unpaid')
  })

  it('12. mesmo checkoutRequestId → mesma Order', async () => {
    const payload = createMockPayload()
    const id = uuidv4()
    const r1 = await createOrder(payload, makeValidInput([1], { checkoutRequestId: id }))
    const r2 = await createOrder(payload, makeValidInput([1], { checkoutRequestId: id }))
    expect(r2.order.id).toBe(r1.order.id)
  })

  it('13. mesmo checkoutRequestId com items diferentes → conflito', async () => {
    const payload = createMockPayload()
    const id = uuidv4()
    await createOrder(payload, makeValidInput([1], { checkoutRequestId: id }))
    await expect(createOrder(payload, makeValidInput([2], {
      checkoutRequestId: id,
    }))).rejects.toThrow(IdempotencyConflictError)
  })

  it('13b. emails diferentes → conflito', async () => {
    const payload = createMockPayload()
    const id = uuidv4()
    await createOrder(payload, makeValidInput([1], {
      checkoutRequestId: id,
      customer: { name: 'Ana', email: 'ana@example.com', phone: '+351911111111' },
    }))
    await expect(createOrder(payload, makeValidInput([1], {
      checkoutRequestId: id,
      customer: { name: 'Outra', email: 'outra@example.com', phone: '+351922222222' },
    }))).rejects.toThrow(IdempotencyConflictError)
  })

  it('14. orderNumber é único', async () => {
    const payload = createMockPayload()
    const r1 = await createOrder(payload, makeValidInput([1]))
    const r2 = await createOrder(payload, makeValidInput([2]))
    expect(r1.order.orderNumber).not.toBe(r2.order.orderNumber)
  })

  it('rejeita country inválido', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], {
      shippingAddress: { ...makeValidInput([1]).shippingAddress, country: 'Portugal' },
    }))).rejects.toThrow(OrderValidationError)
  })

  it('rejeita locale inválido', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], { locale: 'fr' as any }))).rejects.toThrow(OrderValidationError)
  })

  it('rejeita checkoutRequestId não UUID', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], { checkoutRequestId: 'not-a-uuid' }))).rejects.toThrow(OrderValidationError)
  })

  it('rejeita items vazios', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], { items: [] }))).rejects.toThrow(OrderValidationError)
  })

  it('rejeita customer sem name', async () => {
    const payload = createMockPayload()
    await expect(createOrder(payload, makeValidInput([1], {
      customer: { name: '', email: 'x@y.com', phone: '+351912345678' },
    }))).rejects.toThrow(OrderValidationError)
  })

  it('normaliza country para uppercase', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1], {
      shippingAddress: { ...makeValidInput([1]).shippingAddress, country: 'pt' },
    }))
    expect(result.order.shippingAddress.country).toBe('PT')
  })

  it('normaliza email para lowercase', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1], {
      customer: { name: 'Test', email: 'MariaS@Example.COM', phone: '+351912345678' },
    }))
    expect(result.order.customer.email).toBe('marias@example.com')
    expect(result.order.email).toBe('marias@example.com')
  })

  it('guarda campos legacy email e status', async () => {
    const payload = createMockPayload()
    const result = await createOrder(payload, makeValidInput([1]))
    expect(result.order.email).toBe('maria@example.com')
    expect(result.order.status).toBe('pending')
  })
})