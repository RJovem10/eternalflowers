import { describe, expect, it, vi } from 'vitest'
import {
  completeOrder,
  markOrderShipped,
  startOrderProcessing,
} from './order-fulfillment'

describe('paid manual-order fulfillment compatibility', () => {
  it('O/N: a paid external order without email follows confirmed → processing → shipped → completed', async () => {
    let order: any = {
      id: 42,
      orderNumber: 'EF-20260822-MANUAL',
      orderSource: 'manual',
      salesChannel: 'phone',
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentProvider: 'manual',
      paymentMethodType: 'cash',
      manualPaymentConfirmedBy: 9,
      paidAt: '2026-08-22T16:00:00.000Z',
      customer: { name: 'Maria', email: null },
      email: '',
      locale: 'pt',
    }
    const payload: any = {
      findByID: vi.fn(async ({ collection, id }: any) => (
        collection === 'orders' && Number(id) === order.id ? order : null
      )),
      update: vi.fn(async ({ collection, id, data }: any) => {
        if (collection !== 'orders' || Number(id) !== order.id) throw new Error('Unexpected update')
        order = { ...order, ...data }
        return order
      }),
      find: vi.fn(),
      create: vi.fn(),
      db: { name: 'sqlite' },
    }

    await expect(startOrderProcessing(payload, { orderId: 42 }))
      .resolves.toMatchObject({ kind: 'processing_started', orderId: 42 })
    await expect(markOrderShipped(payload, { orderId: 42, trackingNumber: '  CTT-123  ' }))
      .resolves.toMatchObject({ kind: 'shipped', orderId: 42, trackingNumber: 'CTT-123' })
    await expect(completeOrder(payload, { orderId: 42 }))
      .resolves.toMatchObject({ kind: 'completed', orderId: 42 })

    expect(order).toMatchObject({
      orderStatus: 'completed',
      paymentStatus: 'paid',
      paymentProvider: 'manual',
      paymentMethodType: 'cash',
      trackingNumber: 'CTT-123',
    })
    expect(order.processingAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(order.shippedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(order.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })
})
