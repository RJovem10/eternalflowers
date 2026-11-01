import type { Payload } from 'payload'
import type { Order } from '@/payload-types'
import { enqueueEmailNotification, dedupKeyAdminPaid } from './email-notifications'
import { runInTransaction } from '../transact'
import { lockOrderForUpdate } from '../db-adapter'

import { getAdminOrderRecipient, getAdminOrderURL } from './admin-email-config'
export { getAdminOrderRecipient } from './admin-email-config'

/** Apenas enfileira; nunca envia nem modifica a encomenda. O chamador mantém o lock. */
export async function enqueueAdminOrderPaid(payload: Payload, order: Order, req: any) {
  if (order.paymentStatus !== 'paid' || !['confirmed', 'processing', 'shipped', 'completed'].includes(order.orderStatus || '')) {
    throw new Error('A notificação administrativa exige uma encomenda confirmada e paga.')
  }
  const address = order.shippingAddress
  return enqueueEmailNotification(payload, {
    type: 'admin_order_paid',
    orderId: order.id,
    recipientEmail: getAdminOrderRecipient(),
    locale: 'pt',
    deduplicationKey: dedupKeyAdminPaid(order.id),
    req,
    snapshot: {
      type: 'admin_order_paid',
      data: {
        orderNumber: order.orderNumber || String(order.id),
        orderDate: order.createdAt || null,
        customerName: order.customer?.name || '',
        customerEmail: order.customer?.email || order.email || '',
        customerPhone: order.customer?.phone || address?.phone || '',
        items: (order.items || []).map(item => ({
          name: item.name || '', qty: Number(item.qty) || 1,
          unitPrice: Number(item.price) || 0, lineTotal: Number(item.lineTotal) || 0,
        })),
        subtotal: Number(order.subtotal) || 0,
        discount: Number(order.discount) || 0,
        shippingCost: Number(order.shippingCost) || 0,
        total: Number(order.total) || 0,
        currency: order.currency || 'EUR',
        paymentStatus: 'paid',
        deliveryMethod: order.shippingServiceName || order.shippingServiceCode || 'Não registado',
        shippingAddress: [address?.recipientName, address?.line1, address?.line2,
          address?.postalCode, address?.city, address?.region, address?.country].filter((v): v is string => Boolean(v)),
        adminOrderURL: getAdminOrderURL(order.id),
      },
    },
  })
}

/** Recuperação limitada à encomenda histórica, com simulação por defeito. */
export async function recoverHistoricalAdminNotification(payload: Payload, apply = false) {
  return runInTransaction(payload, undefined, async ctx => {
    await lockOrderForUpdate(ctx, 12)
    const order = await payload.findByID({
      collection: 'orders', id: 12, depth: 0, overrideAccess: true, req: ctx.req,
    })
    if (order.orderNumber !== 'EF-20261031-07835F61' || order.paymentStatus !== 'paid' ||
        !['confirmed', 'processing', 'shipped', 'completed'].includes(order.orderStatus || '') ||
        Number(order.total) !== 34 || order.currency !== 'EUR' ||
        !order.createdAt?.startsWith('2026-10-31')) {
      throw new Error('A encomenda histórica não corresponde aos critérios de recuperação.')
    }
    getAdminOrderRecipient()
    getAdminOrderURL(order.id)
    if (!apply) return { kind: 'dry_run' as const, orderId: 12, deduplicationKey: dedupKeyAdminPaid(12) }
    return enqueueAdminOrderPaid(payload, order, ctx.req)
  })
}
