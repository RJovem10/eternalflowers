import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: sdk.send } } }))
vi.mock('../transact', () => {
  const run = async (payload: any, req: any, fn: any) => {
    const ctx = { req: req || { payload, transactionID: 'test-tx' }, ownsTransaction: !req }
    const before = structuredClone(payload.state)
    try { return await fn(ctx) } catch (err) { payload.state = before; throw err }
  }
  return { runInTransaction: run, runInTransactionWithRetry: run }
})
vi.mock('../db-adapter', () => ({ lockOrderForUpdate: vi.fn(), lockCouponForUpdate: vi.fn() }))
vi.mock('../stock', () => ({ confirmReservation: vi.fn() }))

import { settleOrderPayment } from '../payments/payment-settlement'
import { enqueueAdminOrderPaid, getAdminOrderRecipient, recoverHistoricalAdminNotification } from './admin-order-paid'
import { processPendingEmailNotifications } from './email-notifications'
import { renderEmail } from './email-templates'
import { resendEmailProvider, resetResendClient } from './providers/resend'

function fixture() {
  return {
    id: 12, orderNumber: 'EF-20261031-07835F61', createdAt: '2026-10-31T12:00:00.000Z',
    orderSource: 'manual', orderStatus: 'pending_payment', paymentStatus: 'unpaid',
    subtotal: 40, discount: 10, shippingCost: 4, total: 34, currency: 'EUR',
    customer: { name: 'Cliente de teste <script>', email: 'customer@example.test', phone: '+351000000000' },
    shippingServiceName: 'Entrega standard', shippingAddress: {
      recipientName: 'Destinatário de teste', line1: 'Morada de teste', line2: 'Andar de teste',
      postalCode: '0000-000', city: 'Cidade', region: 'Distrito', country: 'PT',
    },
    items: [{ name: 'Rosa <b>', qty: 2, price: 20, lineTotal: 40, productionMode: 'made_to_order' }],
  }
}
function mockPayload() {
  const payload: any = { state: { order: fixture(), notifications: [] as any[] } }
  payload.findByID = vi.fn(async ({ collection, id }: any) => structuredClone(collection === 'orders'
    ? payload.state.order : payload.state.notifications.find((n: any) => n.id === id)))
  payload.find = vi.fn(async ({ collection, where }: any) => ({ docs: collection !== 'email-notifications' ? [] :
    structuredClone(payload.state.notifications.filter((n: any) => where?.deduplicationKey
      ? n.deduplicationKey === where.deduplicationKey.equals
      : ['pending', 'failed'].includes(n.status) && n.attemptCount < where.attemptCount.less_than)) }))
  payload.create = vi.fn(async ({ data }: any) => {
    if (payload.state.notifications.some((n: any) => n.deduplicationKey === data.deduplicationKey)) throw new Error('UNIQUE')
    const n = { id: payload.state.notifications.length + 1, ...structuredClone(data) }
    payload.state.notifications.push(n)
    return n
  })
  payload.update = vi.fn(async ({ collection, id, data }: any) => {
    const doc = collection === 'orders' ? payload.state.order : payload.state.notifications.find((n: any) => n.id === id)
    Object.assign(doc, data)
    return structuredClone(doc)
  })
  return payload
}
const manual = { orderId: 12, payment: { provider: 'manual', paymentMethodType: 'cash' } } as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'production')
  vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', 'shop@eternalflowers.pt')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://eternalflowers.pt')
  vi.stubEnv('RESEND_API_KEY', 're_test_fake')
  vi.stubEnv('EMAIL_FROM', 'test@example.test')
  resetResendClient()
})
afterEach(() => vi.unstubAllEnvs())

describe('administrative paid-order outbox', () => {
  it.each(['manual', 'stripe'])('preserves customer confirmation and deduplicates repeated %s settlement', async provider => {
    const payload = mockPayload()
    const input = provider === 'manual' ? manual : {
      orderId: 12, payment: { provider: 'stripe' as const, paymentIntentId: 'pi_test', paymentMethodType: 'card' },
    }
    if (provider === 'stripe') payload.state.order.orderSource = 'website'
    await settleOrderPayment(payload, input)
    await settleOrderPayment(payload, input)
    expect(payload.state.notifications).toHaveLength(2)
    expect(payload.state.notifications[0]).toMatchObject({
      type: 'order_confirmed', recipientEmail: 'customer@example.test', deduplicationKey: 'order-confirmed:12',
    })
    expect(payload.state.notifications[1]).toMatchObject({
      type: 'admin_order_paid', recipientEmail: 'shop@eternalflowers.pt', deduplicationKey: 'admin-order-paid:12',
      payload: { data: { paymentStatus: 'paid', total: 34 } },
    })
    expect(payload.create.mock.calls.every(([args]: any[]) => args.req.transactionID === 'test-tx')).toBe(true)
  })

  it('notifies admin even when a manual customer has no email', async () => {
    const payload = mockPayload()
    payload.state.order.customer.email = ''
    await settleOrderPayment(payload, manual)
    expect(payload.state.notifications.map((n: any) => n.type)).toEqual(['admin_order_paid'])
  })

  it('renders all order details, escapes HTML and links to the admin order', async () => {
    const payload = mockPayload()
    await settleOrderPayment(payload, manual)
    const rendered = renderEmail(payload.state.notifications[1].payload, 'pt')
    for (const value of ['EF-20261031-07835F61', '31/10/2026', 'Cliente de teste', 'customer@example.test',
      '+351000000000', 'Rosa', '2', '20.00 EUR', '40.00 EUR', '-10.00 EUR', '4.00 EUR', '34.00 EUR',
      'Pago (paid)', 'Entrega standard', 'Morada de teste', 'Andar de teste', '0000-000', 'Cidade', 'Distrito', 'PT',
      'https://eternalflowers.pt/admin/collections/orders/12']) {
      expect(rendered.text).toContain(value)
      expect(rendered.html).toContain(value)
    }
    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).toContain('&lt;script&gt;')
    expect(rendered.html).toContain('Rosa &lt;b&gt;')
  })

  it('processes via mocked Resend and retries only the failed admin notification', async () => {
    const payload = mockPayload()
    await settleOrderPayment(payload, manual)
    sdk.send.mockResolvedValueOnce({ data: { id: 'customer-msg' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { name: 'rate_limit', statusCode: 429, message: 'test' } })
    expect(await processPendingEmailNotifications(payload, { provider: resendEmailProvider })).toMatchObject({ sent: 1, failed: 1 })
    expect(payload.state.notifications.map((n: any) => n.status)).toEqual(['sent', 'failed'])
    sdk.send.mockResolvedValueOnce({ data: { id: 'admin-msg' }, error: null })
    expect(await processPendingEmailNotifications(payload, { provider: resendEmailProvider })).toMatchObject({ sent: 1, failed: 0 })
    expect(sdk.send).toHaveBeenCalledTimes(3)
    expect(sdk.send.mock.calls[1]).toEqual(sdk.send.mock.calls[2])
    expect(sdk.send.mock.calls[2][0]).toMatchObject({ to: 'shop@eternalflowers.pt', text: expect.stringContaining('34.00 EUR') })
    expect(sdk.send.mock.calls[2][1]).toEqual({ idempotencyKey: 'admin-order-paid:12' })
    expect(payload.state.notifications[1]).toMatchObject({ provider: 'resend', providerMessageId: 'admin-msg', attemptCount: 2 })
  })

  it('blocks persisted production recipients after moving the outbox to staging', async () => {
    const payload = mockPayload()
    await settleOrderPayment(payload, manual)
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'sandbox')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3003')
    payload.state.notifications[0].status = 'sent'
    expect(await processPendingEmailNotifications(payload, { provider: resendEmailProvider })).toMatchObject({ errors: 1 })
    expect(sdk.send).not.toHaveBeenCalled()
    expect(payload.state.notifications[1]).toMatchObject({ status: 'failed', attemptCount: 1 })
  })

  it('admin delivery succeeds independently when customer delivery fails', async () => {
    const payload = mockPayload()
    await settleOrderPayment(payload, manual)
    sdk.send.mockResolvedValueOnce({ data: null, error: { name: 'test_error', message: 'temporary', statusCode: 503 } })
      .mockResolvedValueOnce({ data: { id: 'admin-msg' }, error: null })
    await processPendingEmailNotifications(payload, { provider: resendEmailProvider })
    expect(payload.state.notifications.map((n: any) => n.status)).toEqual(['failed', 'sent'])
  })

  it('sent admin notifications remain untouched by historical recovery', async () => {
    const payload = mockPayload()
    await settleOrderPayment(payload, manual)
    sdk.send.mockResolvedValue({ data: { id: 'sent-msg' }, error: null })
    await processPendingEmailNotifications(payload, { provider: resendEmailProvider })
    const before = structuredClone(payload.state.notifications)
    expect(await recoverHistoricalAdminNotification(payload, true)).toMatchObject({ kind: 'already_queued' })
    expect(payload.state.notifications).toEqual(before)
    expect(sdk.send).toHaveBeenCalledTimes(2)
  })

  it('omits address when no address is registered and marks missing details explicitly', async () => {
    const payload = mockPayload()
    payload.state.order.shippingAddress = null
    payload.state.order.shippingServiceName = null
    await settleOrderPayment(payload, manual)
    const rendered = renderEmail(payload.state.notifications[1].payload, 'pt')
    expect(rendered.html).not.toContain('Morada de entrega')
    expect(rendered.text).toContain('Método de entrega: Não registado')
    expect(rendered.html).not.toContain('Rua das Flores, 123')
  })

  it('retries a thrown provider exception through the existing outbox', async () => {
    const payload = mockPayload()
    payload.state.order.customer.email = ''
    await settleOrderPayment(payload, manual)
    sdk.send.mockRejectedValueOnce(new Error('temporary outage'))
    expect(await processPendingEmailNotifications(payload, { provider: resendEmailProvider })).toMatchObject({ errors: 1 })
    expect(payload.state.notifications[0]).toMatchObject({ status: 'failed', attemptCount: 1 })
    sdk.send.mockResolvedValueOnce({ data: { id: 'retry-msg' }, error: null })
    expect(await processPendingEmailNotifications(payload, { provider: resendEmailProvider })).toMatchObject({ sent: 1 })
  })

  it.each(['unpaid', 'pending', 'failed', 'refunded'])('rejects admin enqueue for %s orders', async paymentStatus => {
    const payload = mockPayload()
    payload.state.order.paymentStatus = paymentStatus
    await expect(enqueueAdminOrderPaid(payload, payload.state.order, undefined)).rejects.toThrow(/paga/)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('rolls back settlement when admin enqueue fails', async () => {
    const payload = mockPayload()
    const create = payload.create.getMockImplementation()
    payload.create.mockImplementation(async (args: any) => {
      if (args.data.type === 'admin_order_paid') throw new Error('DB unavailable')
      return create(args)
    })
    await expect(settleOrderPayment(payload, manual)).rejects.toThrow('DB unavailable')
    expect(payload.state.order.paymentStatus).toBe('unpaid')
    expect(payload.state.notifications).toEqual([])
  })

  it.each(['', 'invalid', 'a@example.test,b@example.test', 'a@example.test\r\nBcc:x@example.test'])('rejects invalid recipient configuration (%j)', value => {
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', value)
    expect(getAdminOrderRecipient).toThrow(/ADMIN_ORDER_NOTIFICATION_EMAIL/)
  })

  it('uses the configured sandbox recipient', () => {
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_ENV', 'sandbox')
    vi.stubEnv('ADMIN_ORDER_NOTIFICATION_EMAIL', ' admin@example.test ')
    expect(getAdminOrderRecipient()).toBe('admin@example.test')
  })

  it('historical recovery defaults to dry run and creates only one admin notification', async () => {
    const payload = mockPayload()
    Object.assign(payload.state.order, { paymentStatus: 'paid', orderStatus: 'confirmed' })
    const before = structuredClone(payload.state.order)
    expect(await recoverHistoricalAdminNotification(payload)).toMatchObject({ kind: 'dry_run' })
    expect(payload.create).not.toHaveBeenCalled()
    expect(await recoverHistoricalAdminNotification(payload, true)).toMatchObject({ kind: 'created' })
    expect(await recoverHistoricalAdminNotification(payload, true)).toMatchObject({ kind: 'already_queued' })
    expect(payload.state.notifications.map((n: any) => n.type)).toEqual(['admin_order_paid'])
    expect(payload.state.order).toEqual(before)
    expect(payload.update).not.toHaveBeenCalled()
    expect(sdk.send).not.toHaveBeenCalled()
  })

  it.each([{ total: 35 }, { paymentStatus: 'unpaid' }, { orderNumber: 'different' },
    { createdAt: '2026-10-30T12:00:00Z' }, { currency: 'USD' }, { orderStatus: 'cancelled' }])('refuses mismatched historical order %j', mismatch => {
    const payload = mockPayload()
    Object.assign(payload.state.order, { paymentStatus: 'paid', orderStatus: 'confirmed' }, mismatch)
    return expect(recoverHistoricalAdminNotification(payload, true)).rejects.toThrow(/critérios/)
  })
})
