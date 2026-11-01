import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), constructWebhookEvent: vi.fn(), getProvider: vi.fn() }))
// Mantém initTransaction real do Payload e os helpers transacionais reais.
vi.mock('payload', async importOriginal => ({ ...await importOriginal<typeof import('payload')>(), getPayload: mocks.getPayload }))
vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('@/services/payments/stripe', async importOriginal => ({
  ...await importOriginal<typeof import('../payments/stripe')>(), constructWebhookEvent: mocks.constructWebhookEvent,
}))
vi.mock('./get-email-provider', () => ({ getConfiguredEmailProvider: mocks.getProvider }))
import { POST } from '@/app/api/webhooks/stripe/route'
import { recoverHistoricalAdminNotification } from './admin-order-paid'

function payloadFixture() {
  const payload: any = {
    state: { order: {
      id: 12, orderNumber: 'EF-20261031-07835F61', createdAt: '2026-10-31T12:00:00Z',
      orderSource: 'manual', orderStatus: 'pending_payment', paymentStatus: 'unpaid',
      stripePaymentIntentId: 'pi_audit_test', paymentProvider: 'stripe', total: 34, currency: 'EUR',
      customer: { name: 'Synthetic', email: 'customer@example.test' }, items: [],
    }, notifications: [] },
  }
  let snapshot: any
  payload.db = {
    name: 'sqlite',
    beginTransaction: vi.fn(async () => { snapshot = structuredClone(payload.state); return 'audit-tx' }),
    commitTransaction: vi.fn(async () => {}),
    rollbackTransaction: vi.fn(async () => { payload.state = structuredClone(snapshot) }),
  }
  payload.findByID = vi.fn(async () => structuredClone(payload.state.order))
  payload.find = vi.fn(async ({ collection, where }: any) => ({ docs: collection === 'orders' ? [structuredClone(payload.state.order)] :
    payload.state.notifications.filter((n: any) => n.deduplicationKey === where.deduplicationKey.equals) }))
  payload.update = vi.fn(async ({ data, req }: any) => {
    expect(req.transactionID).toBe('audit-tx')
    Object.assign(payload.state.order, data)
    return structuredClone(payload.state.order)
  })
  payload.create = vi.fn(async ({ data, req }: any) => {
    expect(req.transactionID).toBe('audit-tx')
    const doc = { id: payload.state.notifications.length + 1, ...structuredClone(data) }
    payload.state.notifications.push(doc)
    return doc
  })
  return payload
}
function request() { return new NextRequest('http://localhost/api/webhooks/stripe', {
  method: 'POST', body: '{}', headers: { 'stripe-signature': 'synthetic-signature' },
}) }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'sandbox')
  vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', 'admin@example.invalid')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getProvider.mockRejectedValue(new Error('email disabled in audit'))
  mocks.constructWebhookEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: {
    id: 'pi_audit_test', amount: 3400, currency: 'eur', metadata: { orderId: '12' }, payment_method_types: ['card'],
  } } })
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('Stripe webhook recovery with the real transaction helpers', () => {
  it('returns 500 and rolls back both notifications and payment, then succeeds once on redelivery', async () => {
    const payload = payloadFixture()
    mocks.getPayload.mockResolvedValue(payload)
    const create = payload.create.getMockImplementation()
    let fail = true
    payload.create.mockImplementation(async (args: any) => {
      if (args.data.type === 'admin_order_paid' && fail) { fail = false; throw new Error('temporary admin outbox failure') }
      return create(args)
    })
    expect((await POST(request())).status).toBe(500)
    expect(payload.state.order).toMatchObject({ paymentStatus: 'unpaid', orderStatus: 'pending_payment' })
    expect(payload.state.notifications).toEqual([])
    expect(payload.db.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(payload.db.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.getProvider).not.toHaveBeenCalled()

    expect((await POST(request())).status).toBe(200)
    expect(payload.state.order).toMatchObject({ paymentStatus: 'paid', orderStatus: 'confirmed' })
    expect(payload.state.notifications.map((n: any) => n.type)).toEqual(['order_confirmed', 'admin_order_paid'])
    expect(payload.db.commitTransaction).toHaveBeenCalledTimes(1)
    expect((await POST(request())).status).toBe(200)
    expect(payload.state.notifications).toHaveLength(2)
  })

  it('historical recovery reuses a single real transaction and leaves an existing sent record untouched', async () => {
    const payload = payloadFixture()
    Object.assign(payload.state.order, { paymentStatus: 'paid', orderStatus: 'confirmed' })
    const order = structuredClone(payload.state.order)
    await recoverHistoricalAdminNotification(payload, true)
    expect(payload.db.beginTransaction).toHaveBeenCalledTimes(1)
    expect(payload.db.commitTransaction).toHaveBeenCalledTimes(1)
    payload.state.notifications[0].status = 'sent'
    expect(await recoverHistoricalAdminNotification(payload, true)).toMatchObject({ kind: 'already_queued' })
    expect(payload.state.notifications).toHaveLength(1)
    expect(payload.state.notifications[0]).toMatchObject({ type: 'admin_order_paid', status: 'sent' })
    expect(payload.state.order).toEqual(order)
    expect(payload.update).not.toHaveBeenCalled()
    expect(mocks.getProvider).not.toHaveBeenCalled()
  })
})
