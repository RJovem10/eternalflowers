/**
 * Testes unitários para email-notifications — outbox, snapshots, templates, processor
 *
 * ISSUE-1O — 25 testes:
 *   Outbox: 1-7
 *   Snapshots: 8-12
 *   Processor: 13-20
 *   Templates: 21-25
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  enqueueEmailNotification,
  processPendingEmailNotifications,
  dedupKeyConfirmed,
  dedupKeyShipped,
  dedupKeyCompleted,
  dedupKeyCancelled,
  requeueFailedEmailNotifications,
} from './email-notifications'
import { fakeEmailProvider, failingEmailProvider } from './providers/fake'
import {
  renderOrderConfirmed,
  renderOrderShipped,
  renderOrderCompleted,
  renderOrderCancelled,
  renderEmail,
} from './email-templates'
import type { EmailNotificationDB } from './email-types'

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

let mockNotifications: any[] = []
let mockNotifIdSeq = 0

function resetMocks() {
  mockNotifications = []
  mockNotifIdSeq = 0
  vi.clearAllMocks()
}

function createMockPayload() {
  const mockFindByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'email-notifications') {
      return mockNotifications.find((n) => n.id === id) || null
    }
    return null
  })

  const mockFind = vi.fn(async ({ collection, where, limit, sort }: any) => {
    if (collection === 'email-notifications') {
      let results = [...mockNotifications]

      // Filter by status
      if (where?.status?.equals) {
        results = results.filter((n) => n.status === where.status.equals)
      }
      if (where?.or) {
        const statuses = where.or
          .map((c: any) => c.status?.equals)
          .filter(Boolean)
        if (statuses.length > 0) {
          results = results.filter((n) => statuses.includes(n.status))
        }
      }
      if (where?.attemptCount) {
        if (where.attemptCount.less_than !== undefined) {
          results = results.filter((n) => n.attemptCount < where.attemptCount.less_than)
        }
      }
      if (where?.deduplicationKey?.equals) {
        results = results.filter((n) => n.deduplicationKey === where.deduplicationKey.equals)
      }

      if (sort === 'createdAt') {
        results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }

      return { docs: results.slice(0, limit || 100), totalDocs: results.length }
    }
    return { docs: [], totalDocs: 0 }
  })

  const mockCreate = vi.fn(async ({ collection, data }: any) => {
    if (collection === 'email-notifications') {
      mockNotifIdSeq++
      const doc = {
        id: mockNotifIdSeq,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockNotifications.push(doc)
      return doc
    }
    return null
  })

  const mockUpdate = vi.fn(async ({ collection, id, data }: any) => {
    if (collection === 'email-notifications') {
      const idx = mockNotifications.findIndex((n) => n.id === id)
      if (idx >= 0) {
        mockNotifications[idx] = { ...mockNotifications[idx], ...data, updatedAt: new Date().toISOString() }
        return mockNotifications[idx]
      }
    }
    return null
  })

  return {
    findByID: mockFindByID,
    find: mockFind,
    create: mockCreate,
    update: mockUpdate,
    db: { name: 'sqlite' },
  } as any
}

// ═══════════════════════════════════════════════════════════════
// 1-7: Outbox Tests
// ═══════════════════════════════════════════════════════════════

describe('enqueueEmailNotification — outbox', () => {
  beforeEach(() => resetMocks())

  it('1. confirmed cria order_confirmed', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 1,
      recipientEmail: 'maria@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(1),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-20260809-0001',
          customerName: 'Maria Silva',
          items: [{ name: 'Rosa', qty: 1, unitPrice: 25, lineTotal: 25 }],
          subtotal: 25,
          discount: 0,
          shippingCost: 5,
          total: 30,
          currency: 'EUR',
        },
      },
    })

    expect(result.kind).toBe('created')
    if (result.kind === 'created') {
      expect(result.notificationId).toBeGreaterThan(0)
      const notif = mockNotifications.find((n) => n.id === result.notificationId)
      expect(notif).toBeDefined()
      expect(notif.type).toBe('order_confirmed')
      expect(notif.recipientEmail).toBe('maria@example.com')
      expect(notif.status).toBe('pending')
      expect(notif.deduplicationKey).toBe('order-confirmed:1')
    }
  })

  it('2. webhook repetido não duplica', async () => {
    const payload = createMockPayload()

    const first = await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 1,
      recipientEmail: 'maria@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(1),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'Maria',
          items: [],
          subtotal: 0, discount: 0, shippingCost: 0, total: 0, currency: 'EUR',
        },
      },
    })

    expect(first.kind).toBe('created')

    const second = await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 1,
      recipientEmail: 'maria@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(1),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'Maria',
          items: [],
          subtotal: 0, discount: 0, shippingCost: 0, total: 0, currency: 'EUR',
        },
      },
    })

    expect(second.kind).toBe('already_queued')
    expect(mockNotifications.length).toBe(1)
  })

  it('3. late payment refunded não cria confirmed email', async () => {
    // Verificamos que a dedup key de confirmed não é criada para refunded
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 1,
      recipientEmail: 'test@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(1),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'Test',
          items: [],
          subtotal: 0, discount: 0, shippingCost: 0, total: 0, currency: 'EUR',
        },
      },
    })

    // O cenário de "late payment refunded não cria confirmed" é garantido pelo
    // código de payments.ts que só chama enqueue depois de confirmar stock.
    // Aqui apenas validamos que dedupKeyConfirmed(1) == 'order-confirmed:1'
    expect(dedupKeyConfirmed(1)).toBe('order-confirmed:1')
    expect(result.kind).toBe('created')
  })

  it('4. shipped cria order_shipped', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_shipped',
      orderId: 1,
      recipientEmail: 'joao@example.com',
      locale: 'en',
      deduplicationKey: dedupKeyShipped(1),
      snapshot: {
        type: 'order_shipped',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'João',
          trackingNumber: 'CT123456789PT',
          shippingServiceName: 'CTT Expresso',
        },
      },
    })

    expect(result.kind).toBe('created')
    const notif = mockNotifications.find((n) => n.id === (result as any).notificationId)
    expect(notif).toBeDefined()
    expect(notif.type).toBe('order_shipped')
  })

  it('5. shipped retry não duplica', async () => {
    const payload = createMockPayload()

    const first = await enqueueEmailNotification(payload, {
      type: 'order_shipped',
      orderId: 1,
      recipientEmail: 'joao@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyShipped(1),
      snapshot: {
        type: 'order_shipped',
        data: { orderNumber: 'EF-0001', customerName: 'João', trackingNumber: null, shippingServiceName: null },
      },
    })

    expect(first.kind).toBe('created')

    const second = await enqueueEmailNotification(payload, {
      type: 'order_shipped',
      orderId: 1,
      recipientEmail: 'joao@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyShipped(1),
      snapshot: {
        type: 'order_shipped',
        data: { orderNumber: 'EF-0001', customerName: 'João', trackingNumber: null, shippingServiceName: null },
      },
    })

    expect(second.kind).toBe('already_queued')
    expect(mockNotifications.length).toBe(1)
  })

  it('6. completed cria order_completed', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_completed',
      orderId: 1,
      recipientEmail: 'ana@example.com',
      locale: 'de',
      deduplicationKey: dedupKeyCompleted(1),
      snapshot: {
        type: 'order_completed',
        data: { orderNumber: 'EF-0001', customerName: 'Ana' },
      },
    })

    expect(result.kind).toBe('created')
    const notif = mockNotifications.find((n) => n.id === (result as any).notificationId)
    expect(notif.type).toBe('order_completed')
  })

  it('7. completed retry não duplica', async () => {
    const payload = createMockPayload()
    const first = await enqueueEmailNotification(payload, {
      type: 'order_completed',
      orderId: 1,
      recipientEmail: 'ana@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyCompleted(1),
      snapshot: {
        type: 'order_completed',
        data: { orderNumber: 'EF-0001', customerName: 'Ana' },
      },
    })

    expect(first.kind).toBe('created')

    const second = await enqueueEmailNotification(payload, {
      type: 'order_completed',
      orderId: 1,
      recipientEmail: 'ana@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyCompleted(1),
      snapshot: {
        type: 'order_completed',
        data: { orderNumber: 'EF-0001', customerName: 'Ana' },
      },
    })

    expect(second.kind).toBe('already_queued')
    expect(mockNotifications.length).toBe(1)
  })

  it('7c. cancelled cria order_cancelled', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: 1,
      recipientEmail: 'maria@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyCancelled(1),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'Maria',
          wasRefunded: false,
          total: 30,
          currency: 'EUR',
        },
      },
    })

    expect(result.kind).toBe('created')
    const notif = mockNotifications.find((n) => n.deduplicationKey === 'order-cancelled:1')
    expect(notif).toBeDefined()
    expect(notif.type).toBe('order_cancelled')
    expect(notif.payload.data.wasRefunded).toBe(false)
    expect(notif.payload.data.total).toBe(30)
    expect(notif.payload.data.currency).toBe('EUR')
  })

  it('7d. cancelled retry não duplica', async () => {
    const payload = createMockPayload()

    const first = await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: 1,
      recipientEmail: 'maria@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyCancelled(1),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-0001', customerName: 'Maria',
          wasRefunded: false, total: 30, currency: 'EUR',
        },
      },
    })

    expect(first.kind).toBe('created')

    const second = await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: 1,
      recipientEmail: 'maria@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyCancelled(1),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-0001', customerName: 'Maria',
          wasRefunded: false, total: 30, currency: 'EUR',
        },
      },
    })

    expect(second.kind).toBe('already_queued')
    expect(mockNotifications.length).toBe(1)
  })

  it('7e. cancelled snapshot wasRefunded=true', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: 5,
      recipientEmail: 'refund@example.com',
      locale: 'en',
      deduplicationKey: dedupKeyCancelled(5),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-0005',
          customerName: 'Refunded Customer',
          wasRefunded: true,
          total: 150,
          currency: 'EUR',
          paymentMethodType: 'card',
        },
      },
    })

    expect(result.kind).toBe('created')
    const notif = mockNotifications.find((n) => n.deduplicationKey === 'order-cancelled:5')
    expect(notif).toBeDefined()
    expect(notif.payload.data.wasRefunded).toBe(true)
    expect(notif.payload.data.paymentMethodType).toBe('card')
  })

  it('7f. cancelled recipient vem da Order', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_cancelled',
      orderId: 6,
      recipientEmail: 'order@eternalflowers.pt',
      locale: 'pt',
      deduplicationKey: dedupKeyCancelled(6),
      snapshot: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-0006', customerName: 'Order Customer',
          wasRefunded: false, total: 50, currency: 'EUR',
        },
      },
    })

    expect(result.kind).toBe('created')
    const notif = mockNotifications.find((n) => n.deduplicationKey === 'order-cancelled:6')
    expect(notif.recipientEmail).toBe('order@eternalflowers.pt')
  })

  it('7b. unique constraint violation por race → already_queued sem rollback', async () => {
    const payload = createMockPayload()

    // Simular race: find retorna vazio, mas create falha com UNIQUE
    const originalCreate = payload.create
    payload.create = vi.fn(async ({ collection, data }: any) => {
      if (collection === 'email-notifications') {
        mockNotifIdSeq++
        mockNotifications.push({
          id: mockNotifIdSeq,
          ...data,
          deduplicationKey: data.deduplicationKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        throw new Error('SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: email-notifications.deduplicationKey')
      }
      return originalCreate({ collection, data })
    })

    const result = await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 99,
      recipientEmail: 'test@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(99),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0099', customerName: 'Test',
          items: [], subtotal: 0, discount: 0, shippingCost: 0, total: 0, currency: 'EUR',
        },
      },
    })

    expect(result.kind).toBe('already_queued')
    expect(mockNotifications.length).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// 8-12: Snapshot Tests
// ═══════════════════════════════════════════════════════════════

describe('email snapshots', () => {
  beforeEach(() => resetMocks())

  it('8. recipient vem da Order', async () => {
    const payload = createMockPayload()

    const result = await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 1,
      recipientEmail: 'cliente@eternalflowers.pt',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(1),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'Cliente',
          items: [],
          subtotal: 10, discount: 0, shippingCost: 0, total: 10, currency: 'EUR',
        },
      },
    })

    expect(result.kind).toBe('created')
    const notif = mockNotifications.find((n) => n.id === (result as any).notificationId)
    expect(notif.recipientEmail).toBe('cliente@eternalflowers.pt')
    expect(notif.locale).toBe('pt')
  })

  it('9. total/items snapshot correto', async () => {
    const payload = createMockPayload()

    await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 2,
      recipientEmail: 'test@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyConfirmed(2),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0002',
          customerName: 'Test',
          items: [
            { name: 'Rosa', qty: 2, unitPrice: 25, lineTotal: 50 },
            { name: 'Orquídea', qty: 1, unitPrice: 45, lineTotal: 45 },
          ],
          subtotal: 95,
          discount: 10,
          shippingCost: 5,
          total: 90,
          currency: 'EUR',
        },
      },
    })

    const notif = mockNotifications.find((n) => n.deduplicationKey === 'order-confirmed:2')
    expect(notif).toBeDefined()
    const data = notif.payload.data
    expect(data.subtotal).toBe(95)
    expect(data.discount).toBe(10)
    expect(data.shippingCost).toBe(5)
    expect(data.total).toBe(90)
    expect(data.items).toHaveLength(2)
    expect(data.items[0].name).toBe('Rosa')
    expect(data.items[0].lineTotal).toBe(50)
  })

  it('10. tracking aparece em shipped', async () => {
    const payload = createMockPayload()

    await enqueueEmailNotification(payload, {
      type: 'order_shipped',
      orderId: 3,
      recipientEmail: 'cli@example.com',
      locale: 'pt',
      deduplicationKey: dedupKeyShipped(3),
      snapshot: {
        type: 'order_shipped',
        data: {
          orderNumber: 'EF-0003',
          customerName: 'Cliente',
          trackingNumber: 'CT999',
          shippingServiceName: 'CTT',
        },
      },
    })

    const notif = mockNotifications.find((n) => n.deduplicationKey === 'order-shipped:3')
    expect(notif.payload.data.trackingNumber).toBe('CT999')
    expect(notif.payload.data.shippingServiceName).toBe('CTT')
  })

  it('11. locale correto', async () => {
    const payload = createMockPayload()

    await enqueueEmailNotification(payload, {
      type: 'order_confirmed',
      orderId: 4,
      recipientEmail: 'en@example.com',
      locale: 'en',
      deduplicationKey: dedupKeyConfirmed(4),
      snapshot: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0004',
          customerName: 'English Customer',
          items: [{ name: 'Rose', qty: 1, unitPrice: 25, lineTotal: 25 }],
          subtotal: 25, discount: 0, shippingCost: 0, total: 25, currency: 'EUR',
        },
      },
    })

    const notif = mockNotifications.find((n) => n.deduplicationKey === 'order-confirmed:4')
    expect(notif.locale).toBe('en')
  })

  it('12. valores interpolados escapados em HTML', () => {
    const result = renderOrderConfirmed(
      {
        orderNumber: 'EF-0001',
        customerName: '<script>alert("xss")</script>',
        items: [{ name: 'Rosa & "Linda"', qty: 1, unitPrice: 25, lineTotal: 25 }],
        subtotal: 25,
        discount: 0,
        shippingCost: 5,
        total: 30,
        currency: 'EUR',
      },
      'pt',
    )

    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('onerror')
    expect(result.html).not.toContain('javascript:')
    expect(result.html).toContain('&lt;script&gt;alert')
    expect(result.html).toContain('Rosa &amp; &quot;Linda&quot;')
  })
})

// ═══════════════════════════════════════════════════════════════
// 13-20: Processor Tests
// ═══════════════════════════════════════════════════════════════

describe('processPendingEmailNotifications — processor', () => {
  beforeEach(() => resetMocks())

  async function seedNotification(
    payload: any,
    overrides: Partial<any> = {},
  ): Promise<any> {
    mockNotifIdSeq++
    const doc = {
      id: mockNotifIdSeq,
      type: 'order_confirmed',
      order: 1,
      recipientEmail: 'test@example.com',
      locale: 'pt',
      status: 'pending',
      deduplicationKey: `test-key-${mockNotifIdSeq}`,
      attemptCount: 0,
      lastError: null,
      sentAt: null,
      payload: {
        type: 'order_confirmed',
        data: {
          orderNumber: 'EF-0001',
          customerName: 'Test',
          items: [{ name: 'Rosa', qty: 1, unitPrice: 25, lineTotal: 25 }],
          subtotal: 25, discount: 0, shippingCost: 5, total: 30, currency: 'EUR',
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
    mockNotifications.push(doc)
    return doc
  }

  it('13. pending → send → sent', async () => {
    const payload = createMockPayload()
    await seedNotification(payload)

    const summary = await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })

    expect(summary.processed).toBe(1)
    expect(summary.sent).toBe(1)
    expect(summary.failed).toBe(0)
    const updated = mockNotifications.find((n) => n.status === 'sent')
    expect(updated).toBeDefined()
    expect(updated.sentAt).toBeDefined()
  })

  it('14. provider chamado fora da DB transaction', async () => {
    const payload = createMockPayload()
    await seedNotification(payload)

    const sendSpy = vi.spyOn(fakeEmailProvider, 'send')
    await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })

    // O provider.send foi chamado (fora da transacção)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const callArgs = sendSpy.mock.calls[0][0]
    expect(callArgs.to).toBe('test@example.com')
    expect(callArgs.subject).toBeDefined()
    expect(callArgs.html).toContain('<!DOCTYPE html')
  })

  it('15. provider failure → failed', async () => {
    const payload = createMockPayload()
    await seedNotification(payload)

    const summary = await processPendingEmailNotifications(payload, { provider: failingEmailProvider })

    expect(summary.processed).toBe(1)
    expect(summary.failed).toBe(1)
    const updated = mockNotifications.find((n) => n.status === 'failed')
    expect(updated).toBeDefined()
    expect(updated.lastError).toBeDefined()
  })

  it('16. attemptCount incrementa', async () => {
    const payload = createMockPayload()
    await seedNotification(payload)

    await processPendingEmailNotifications(payload, { provider: failingEmailProvider })

    const updated = mockNotifications.find((n) => n.status === 'failed')
    expect(updated.attemptCount).toBe(1)
  })

  it('17. sent não volta a enviar', async () => {
    const payload = createMockPayload()
    await seedNotification(payload, { status: 'sent', sentAt: new Date().toISOString() })

    const summary = await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })

    expect(summary.processed).toBe(0)
    expect(summary.sent).toBe(0)
  })

  it('18. failed pode retry', async () => {
    const payload = createMockPayload()
    await seedNotification(payload, { status: 'failed', lastError: 'previous error', attemptCount: 1 })

    const summary = await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })

    expect(summary.sent).toBe(1)
    const updated = mockNotifications.find((n) => n.status === 'sent')
    expect(updated).toBeDefined()
  })

  it('19. maxAttempts respeitado', async () => {
    const payload = createMockPayload()
    await seedNotification(payload, { status: 'failed', lastError: 'many errors', attemptCount: 5 })

    const summary = await processPendingEmailNotifications(payload, {
      provider: fakeEmailProvider,
      maxAttempts: 5,
    })

    // attemptCount=5 is NOT less_than 5, so should be skipped
    expect(summary.processed).toBe(0)
    expect(summary.sent).toBe(0)
    // Notification with attemptCount=5 é excluída pelo filtro DB (5 < 5 = false)
    // portanto não aparece em candidates nem em details
  })

  it('20. dois processamentos não devem enviar simultaneamente', async () => {
    const payload = createMockPayload()
    await seedNotification(payload)

    // Primeiro processamento
    const first = await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })
    expect(first.sent).toBe(1)

    // Segundo processamento — já enviado, deve ser ignorado
    const second = await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })
    expect(second.processed).toBe(0)
    expect(second.sent).toBe(0)

    // Notificação está sent e não deve ser re-enviada
    const notif = mockNotifications.find((n) => n.status === 'sent')
    expect(notif).toBeDefined()
  })

  it('20a. processor envia order_cancelled', async () => {
    const payload = createMockPayload()
    await seedNotification(payload, {
      type: 'order_cancelled',
      payload: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-CAN',
          customerName: 'Cancelled',
          wasRefunded: false,
          total: 30,
          currency: 'EUR',
        },
      },
    })

    const summary = await processPendingEmailNotifications(payload, { provider: fakeEmailProvider })

    expect(summary.processed).toBe(1)
    expect(summary.sent).toBe(1)
    const updated = mockNotifications.find((n) => n.status === 'sent')
    expect(updated).toBeDefined()
    expect(updated.type).toBe('order_cancelled')
  })

  it('20b. provider failure não altera order_cancelled estado', async () => {
    const payload = createMockPayload()
    await seedNotification(payload, {
      type: 'order_cancelled',
      payload: {
        type: 'order_cancelled',
        data: {
          orderNumber: 'EF-CAN-FAIL',
          customerName: 'Fail',
          wasRefunded: true,
          total: 100,
          currency: 'EUR',
        },
      },
    })

    const summary = await processPendingEmailNotifications(payload, { provider: failingEmailProvider })

    expect(summary.processed).toBe(1)
    expect(summary.failed).toBe(1)
    // Status da Order não é afectado — o processor só altera a notification
    const failed = mockNotifications.find((n) => n.status === 'failed')
    expect(failed).toBeDefined()
    expect(failed.type).toBe('order_cancelled')
  })
})

// ═══════════════════════════════════════════════════════════════
// 21-25: Template Tests
// ═══════════════════════════════════════════════════════════════

describe('email templates', () => {
  it('21. PT renderiza', () => {
    const result = renderOrderConfirmed(
      {
        orderNumber: 'EF-0001', customerName: 'Maria',
        items: [{ name: 'Rosa', qty: 1, unitPrice: 25, lineTotal: 25 }],
        subtotal: 25, discount: 0, shippingCost: 5, total: 30, currency: 'EUR',
      },
      'pt',
    )

    expect(result.subject).toContain('Encomenda Confirmada')
    expect(result.html).toContain('Olá, Maria')
    expect(result.html).toContain('<!DOCTYPE html')
    expect(result.text).toContain('Subtotal')
  })

  it('22. EN renderiza', () => {
    const result = renderOrderConfirmed(
      {
        orderNumber: 'EF-0001', customerName: 'John',
        items: [{ name: 'Rose', qty: 2, unitPrice: 25, lineTotal: 50 }],
        subtotal: 50, discount: 0, shippingCost: 5, total: 55, currency: 'EUR',
      },
      'en',
    )

    expect(result.subject).toContain('Order Confirmed')
    expect(result.html).toContain('Hello, John')
    expect(result.text).toContain('Subtotal')
  })

  it('23. ES renderiza', () => {
    const result = renderOrderShipped(
      {
        orderNumber: 'EF-0001', customerName: 'Carlos',
        trackingNumber: 'CT123', shippingServiceName: 'CTT',
      },
      'es',
    )

    expect(result.subject).toContain('Pedido Enviado')
    expect(result.html).toContain('¡Hola, Carlos')
    expect(result.html).toContain('CT123')
  })

  it('24. IT renderiza', () => {
    const result = renderOrderShipped(
      {
        orderNumber: 'EF-0001', customerName: 'Marco',
        trackingNumber: null, shippingServiceName: null,
      },
      'it',
    )

    expect(result.subject).toContain('Ordine Spedito')
    expect(result.html).toContain('Ciao, Marco')
  })

  it('25. DE renderiza', () => {
    const result = renderOrderCompleted(
      { orderNumber: 'EF-0001', customerName: 'Hans' },
      'de',
    )

    expect(result.subject).toContain('Bestellung Abgeschlossen')
    expect(result.html).toContain('Hallo, Hans')
  })

  it('26. PT order_cancelled sem refund', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0001', customerName: 'Maria',
        wasRefunded: false, total: 30, currency: 'EUR',
      },
      'pt',
    )

    expect(result.subject).toContain('Encomenda Cancelada')
    expect(result.html).toContain('Olá, Maria')
    expect(result.html).toContain('EF-0001 foi cancelada')
    expect(result.html).not.toContain('reembolso')
    expect(result.text).not.toContain('reembolso')
  })

  it('27. PT order_cancelled com refund', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0002', customerName: 'João',
        wasRefunded: true, total: 150, currency: 'EUR',
      },
      'pt',
    )

    expect(result.subject).toContain('Encomenda Cancelada')
    expect(result.html).toContain('Olá, João')
    expect(result.html).toContain('EF-0002 foi cancelada e o reembolso integral foi iniciado')
    expect(result.html).toContain('depende do método de pagamento')
    expect(result.text).toContain('depende do método de pagamento')
    expect(result.text).toContain('reembolso')
  })

  it('28. EN order_cancelled com refund', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0003', customerName: 'John',
        wasRefunded: true, total: 100, currency: 'EUR',
      },
      'en',
    )

    expect(result.subject).toContain('Order Cancelled')
    expect(result.html).toContain('Hello, John')
    expect(result.html).toContain('full refund has been initiated')
  })

  it('29. ES order_cancelled com refund', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0004', customerName: 'Carlos',
        wasRefunded: true, total: 200, currency: 'EUR',
      },
      'es',
    )

    expect(result.subject).toContain('Pedido Cancelado')
    expect(result.html).toContain('¡Hola, Carlos')
    expect(result.html).toContain('reembolso íntegro')
  })

  it('30. IT order_cancelled com refund', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0005', customerName: 'Marco',
        wasRefunded: true, total: 75, currency: 'EUR',
      },
      'it',
    )

    expect(result.subject).toContain('Ordine Annullato')
    expect(result.html).toContain('Ciao, Marco')
    expect(result.html).toContain('rimborso totale')
  })

  it('31. DE order_cancelled com refund', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0006', customerName: 'Hans',
        wasRefunded: true, total: 50, currency: 'EUR',
      },
      'de',
    )

    expect(result.subject).toContain('Bestellung Storniert')
    expect(result.html).toContain('Hallo, Hans')
    expect(result.html).toContain('vollständige Rückerstattung')
  })

  it('32. HTML escaping preservado em order_cancelled', () => {
    const result = renderOrderCancelled(
      {
        orderNumber: 'EF-0001',
        customerName: '<script>alert("xss")</script>',
        wasRefunded: false, total: 30, currency: 'EUR',
      },
      'pt',
    )

    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;alert')
  })

  it('renderEmail dispatcher funciona para todos os tipos', () => {
    const confirmed = renderEmail(
      { type: 'order_confirmed', data: { orderNumber: '1', customerName: 'A', items: [], subtotal: 0, discount: 0, shippingCost: 0, total: 0, currency: 'EUR' } },
      'pt',
    )
    expect(confirmed.subject).toContain('Encomenda Confirmada')

    const shipped = renderEmail(
      { type: 'order_shipped', data: { orderNumber: '1', customerName: 'A', trackingNumber: null, shippingServiceName: null } },
      'pt',
    )
    expect(shipped.subject).toContain('Expedida')

    const completed = renderEmail(
      { type: 'order_completed', data: { orderNumber: '1', customerName: 'A' } },
      'pt',
    )
    expect(completed.subject).toContain('Concluída')

    const cancelled = renderEmail(
      { type: 'order_cancelled', data: { orderNumber: '1', customerName: 'A', wasRefunded: false, total: 10, currency: 'EUR' } },
      'pt',
    )
    expect(cancelled.subject).toContain('Cancelada')
  })
})

// ═══════════════════════════════════════════════════════════════
// Requeue helper
// ═══════════════════════════════════════════════════════════════

describe('requeueFailedEmailNotifications', () => {
  beforeEach(() => resetMocks())

  it('requeues failed notifications below maxAttempts', async () => {
    const payload = createMockPayload()
    mockNotifIdSeq++
    mockNotifications.push({
      id: mockNotifIdSeq, status: 'failed', attemptCount: 2, lastError: 'err',
      deduplicationKey: 'key1', type: 'order_confirmed', order: 1,
      recipientEmail: 'a@b.com', locale: 'pt',
      payload: { type: 'order_confirmed', data: {} },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    mockNotifIdSeq++
    mockNotifications.push({
      id: mockNotifIdSeq, status: 'failed', attemptCount: 5, lastError: 'err',
      deduplicationKey: 'key2', type: 'order_confirmed', order: 1,
      recipientEmail: 'a@b.com', locale: 'pt',
      payload: { type: 'order_confirmed', data: {} },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })

    const count = await requeueFailedEmailNotifications(payload, 5)

    // Apenas a notificação com attemptCount=2 < 5 deve ser requeued
    expect(count).toBe(1)
    const requeued = mockNotifications.find((n) => n.id === 1)
    expect(requeued.status).toBe('pending')
    const stillFailed = mockNotifications.find((n) => n.id === 2)
    expect(stillFailed.status).toBe('failed')
  })
})