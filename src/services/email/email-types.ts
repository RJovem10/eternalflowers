/**
 * email-types.ts — Tipos para o sistema de emails transacionais
 *
 * Define snapshots de conteúdo (imutáveis após criação) e tipos
 * de notificação.
 */
import type { Locale } from '@/i18n/locales'

// ─── Tipos de notificação ─────────────────────────────────────

export type EmailNotificationType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_completed'
  | 'order_cancelled'

// ─── Estados de envio ─────────────────────────────────────────

export type EmailNotificationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'

// ─── Snapshots de conteúdo ────────────────────────────────────

export interface OrderConfirmedSnapshot {
  orderNumber: string
  customerName: string
  items: Array<{
    name: string
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  discount: number
  shippingCost: number
  total: number
  currency: string
}

export interface OrderShippedSnapshot {
  orderNumber: string
  customerName: string
  trackingNumber: string | null
  shippingServiceName: string | null
}

export interface OrderCompletedSnapshot {
  orderNumber: string
  customerName: string
}

export interface OrderCancelledSnapshot {
  orderNumber: string
  customerName: string
  wasRefunded: boolean
  total: number
  currency: string
  paymentMethodType?: string | null
}

export type EmailSnapshot =
  | { type: 'order_confirmed'; data: OrderConfirmedSnapshot }
  | { type: 'order_shipped'; data: OrderShippedSnapshot }
  | { type: 'order_completed'; data: OrderCompletedSnapshot }
  | { type: 'order_cancelled'; data: OrderCancelledSnapshot }

// ─── EmailNotification DB shape ───────────────────────────────

export interface EmailNotificationDB {
  id: number
  type: EmailNotificationType
  order: number
  recipientEmail: string
  locale: Locale | string
  status: EmailNotificationStatus
  deduplicationKey: string
  attemptCount: number
  lastError: string | null
  sentAt: string | null
  provider: string | null
  providerMessageId: string | null
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── Enqueue result ──────────────────────────────────────────

export type EnqueueResult =
  | { kind: 'created'; notificationId: number }
  | { kind: 'already_queued'; existingId: number }