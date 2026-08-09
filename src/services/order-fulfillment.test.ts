/**
 * Testes unitários para order-fulfillment.ts — sem Payload real, com mocking.
 *
 * Cobre 24 testes da ISSUE:
 *  1. confirmed+paid → processing
 *  2. processingAt criado server-side
 *  3. unpaid não pode → processing
 *  4. processing+paid → shipped
 *  5. shippedAt criado
 *  6. trackingNumber guardado
 *  7. tracking opcional funciona
 *  8. shipped+paid → completed
 *  9. completedAt criado
 * 10. não pode saltar confirmed → shipped
 * 11. não pode voltar shipped → processing
 * 12. cancelled/expired não avançam
 * 13. repetição processing é idempotente
 * 14. repetição shipped com mesmo tracking é idempotente
 * 15. tracking diferente em repetição → conflito
 * 16. repetição completed é idempotente
 * 17. timestamps não mudam em retry
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startOrderProcessing, markOrderShipped, completeOrder } from './order-fulfillment'
import {
  InvalidOrderTransitionError,
  OrderNotPaidError,
  TrackingConflictError,
  OrderNotFoundError,
} from './order-fulfillment-types'

// ─── Helpers ──────────────────────────────────────────────────

let mockOrders: any[] = []
let mockOrderIdSeq = 0

function resetMocks() {
  mockOrders = []
  mockOrderIdSeq = 0
  vi.clearAllMocks()
}

function createConfirmedPaidOrder(overrides: Partial<any> = {}): any {
  mockOrderIdSeq++
  const order = {
    id: mockOrderIdSeq,
    orderNumber: `EF-20260809-${String(mockOrderIdSeq).padStart(4, '0')}`,
    orderStatus: 'confirmed',
    paymentStatus: 'paid',
    processingAt: null,
    shippedAt: null,
    completedAt: null,
    trackingNumber: null,
    items: [],
    total: 100.00,
    ...overrides,
  }
  mockOrders.push(order)
  return order
}

function createProcessingPaidOrder(overrides: Partial<any> = {}): any {
  return createConfirmedPaidOrder({
    orderStatus: 'processing',
    processingAt: new Date().toISOString(),
    ...overrides,
  })
}

function createShippedPaidOrder(overrides: Partial<any> = {}): any {
  return createConfirmedPaidOrder({
    orderStatus: 'shipped',
    processingAt: new Date().toISOString(),
    shippedAt: new Date().toISOString(),
    ...overrides,
  })
}

function createCompletedOrder(overrides: Partial<any> = {}): any {
  return createConfirmedPaidOrder({
    orderStatus: 'completed',
    processingAt: new Date().toISOString(),
    shippedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  })
}

function createMockPayload() {
  const mockFindByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'orders') {
      return mockOrders.find((o) => o.id === id) || null
    }
    return null
  })

  const mockUpdate = vi.fn(async ({ collection, id, data }: any) => {
    if (collection === 'orders') {
      const idx = mockOrders.findIndex((o) => o.id === id)
      if (idx >= 0) {
        mockOrders[idx] = { ...mockOrders[idx], ...data }
        return mockOrders[idx]
      }
    }
    return null
  })

  return {
    findByID: mockFindByID,
    update: mockUpdate,
    find: vi.fn(),
    create: vi.fn(),
    db: { name: 'sqlite' },
  } as any
}

// ═══════════════════════════════════════════════════════════════
// Testes
// ═══════════════════════════════════════════════════════════════

describe('orderFulfillment — startOrderProcessing', () => {
  beforeEach(() => resetMocks())

  it('1. confirmed+paid → processing', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder()

    const result = await startOrderProcessing(payload, { orderId: order.id })

    expect(result.kind).toBe('processing_started')
    if (result.kind === 'processing_started') {
      expect(result.orderId).toBe(order.id)
      expect(result.processingAt).toBeDefined()
      expect(() => new Date(result.processingAt)).not.toThrow()
    }
  })

  it('2. processingAt criado server-side', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder()

    await startOrderProcessing(payload, { orderId: order.id })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.processingAt).toBeDefined()
    expect(updated.orderStatus).toBe('processing')
  })

  it('3. unpaid não pode → processing', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder({ paymentStatus: 'unpaid' })

    await expect(startOrderProcessing(payload, { orderId: order.id }))
      .rejects.toThrow(OrderNotPaidError)
  })

  it('13. repetição processing é idempotente', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()
    const originalProcessingAt = order.processingAt

    const result = await startOrderProcessing(payload, { orderId: order.id })

    expect(result.kind).toBe('already_processing')
    // Timestamp não mudou
    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.processingAt).toBe(originalProcessingAt)
  })

  it('10. não pode saltar confirmed → shipped', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder()

    // Tentar shipped directamente
    await expect(markOrderShipped(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('12. cancelled não avançam', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder({ orderStatus: 'cancelled' })

    await expect(startOrderProcessing(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('12b. expired não avançam', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder({ orderStatus: 'expired' })

    await expect(startOrderProcessing(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('17. timestamps não mudam em retry (processing)', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()
    const originalProcessingAt = order.processingAt

    await startOrderProcessing(payload, { orderId: order.id })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.processingAt).toBe(originalProcessingAt)
  })
})

describe('orderFulfillment — markOrderShipped', () => {
  beforeEach(() => resetMocks())

  it('4. processing+paid → shipped', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()

    const result = await markOrderShipped(payload, { orderId: order.id })

    expect(result.kind).toBe('shipped')
    if (result.kind === 'shipped') {
      expect(result.shippedAt).toBeDefined()
      expect(result.trackingNumber).toBeNull()
    }
  })

  it('5. shippedAt criado', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()

    await markOrderShipped(payload, { orderId: order.id })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.shippedAt).toBeDefined()
    expect(updated.orderStatus).toBe('shipped')
  })

  it('6. trackingNumber guardado', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()

    await markOrderShipped(payload, { orderId: order.id, trackingNumber: 'CT123456789PT' })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.trackingNumber).toBe('CT123456789PT')
  })

  it('7. tracking opcional funciona (sem tracking)', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()

    const result = await markOrderShipped(payload, { orderId: order.id })

    expect(result.kind).toBe('shipped')
    if (result.kind === 'shipped') {
      expect(result.trackingNumber).toBeNull()
    }
    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.trackingNumber).toBeNull()
  })

  it('7b. tracking vazio tratado como null', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder()

    await markOrderShipped(payload, { orderId: order.id, trackingNumber: '   ' })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.trackingNumber).toBeNull()
  })

  it('14. repetição shipped com mesmo tracking é idempotente', async () => {
    const payload = createMockPayload()
    const order = createShippedPaidOrder({ trackingNumber: 'CT123' })
    const originalShippedAt = order.shippedAt

    const result = await markOrderShipped(payload, { orderId: order.id, trackingNumber: 'CT123' })

    expect(result.kind).toBe('already_shipped')
    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.shippedAt).toBe(originalShippedAt)
    expect(updated.trackingNumber).toBe('CT123')
  })

  it('15. tracking diferente em repetição → conflito', async () => {
    const payload = createMockPayload()
    const order = createShippedPaidOrder({ trackingNumber: 'CT123' })

    await expect(markOrderShipped(payload, { orderId: order.id, trackingNumber: 'DIFFERENT' }))
      .rejects.toThrow(TrackingConflictError)
  })

  it('3. unpaid não pode shipped', async () => {
    const payload = createMockPayload()
    const order = createProcessingPaidOrder({ paymentStatus: 'unpaid' })

    await expect(markOrderShipped(payload, { orderId: order.id }))
      .rejects.toThrow(OrderNotPaidError)
  })

  it('17. timestamps não mudam em retry (shipped)', async () => {
    const payload = createMockPayload()
    const order = createShippedPaidOrder()
    const originalShippedAt = order.shippedAt

    await markOrderShipped(payload, { orderId: order.id })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.shippedAt).toBe(originalShippedAt)
  })
})

describe('orderFulfillment — completeOrder', () => {
  beforeEach(() => resetMocks())

  it('8. shipped+paid → completed', async () => {
    const payload = createMockPayload()
    const order = createShippedPaidOrder()

    const result = await completeOrder(payload, { orderId: order.id })

    expect(result.kind).toBe('completed')
    if (result.kind === 'completed') {
      expect(result.completedAt).toBeDefined()
    }
  })

  it('9. completedAt criado', async () => {
    const payload = createMockPayload()
    const order = createShippedPaidOrder()

    await completeOrder(payload, { orderId: order.id })

    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.completedAt).toBeDefined()
    expect(updated.orderStatus).toBe('completed')
  })

  it('16. repetição completed é idempotente', async () => {
    const payload = createMockPayload()
    const order = createCompletedOrder()
    const originalCompletedAt = order.completedAt

    const result = await completeOrder(payload, { orderId: order.id })

    expect(result.kind).toBe('already_completed')
    const updated = mockOrders.find((o) => o.id === order.id)
    expect(updated.completedAt).toBe(originalCompletedAt)
  })
})

describe('orderFulfillment — transições inválidas', () => {
  beforeEach(() => resetMocks())

  it('11. não pode voltar shipped → processing', async () => {
    const payload = createMockPayload()
    const order = createShippedPaidOrder()

    // Tentar startProcessing de uma shipped order
    await expect(startOrderProcessing(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('10b. não pode saltar confirmed → completed', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder()

    await expect(completeOrder(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('draft não avança', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder({ orderStatus: 'draft', paymentStatus: 'paid' })

    await expect(startOrderProcessing(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('pending_payment não avança', async () => {
    const payload = createMockPayload()
    const order = createConfirmedPaidOrder({ orderStatus: 'pending_payment', paymentStatus: 'paid' })

    await expect(startOrderProcessing(payload, { orderId: order.id }))
      .rejects.toThrow(InvalidOrderTransitionError)
  })

  it('order inexistente → erro', async () => {
    const payload = createMockPayload()

    await expect(startOrderProcessing(payload, { orderId: 9999 }))
      .rejects.toThrow(OrderNotFoundError)
  })
})