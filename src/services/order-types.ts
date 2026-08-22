/**
 * order-types.ts — Contratos de domínio para criação de Orders
 */
import type { Locale } from '@/i18n/locales'

// ─── Address ──────────────────────────────────────────────────

export interface OrderAddressInput {
  recipientName: string
  phone?: string
  line1: string
  line2?: string
  city: string
  region?: string
  postalCode?: string
  country: string
}

// ─── Customer input ───────────────────────────────────────────

export interface OrderCustomerInput {
  name: string
  email: string
  phone: string
  companyName?: string
  taxId?: string
}

export interface ManualOrderCustomerInput {
  name: string
  email?: string
  phone: string
  companyName?: string
  taxId?: string
}

// ─── Item input (só flowerId + qty — nada de preço/nome) ──────

export interface OrderItemInput {
  flowerId: number
  qty: number
}

// ─── CreateOrderInput ─────────────────────────────────────────

export interface CreateOrderInput {
  checkoutRequestId: string
  customer: OrderCustomerInput
  shippingAddress: OrderAddressInput
  billingSameAsShipping: boolean
  billingAddress?: OrderAddressInput
  items: OrderItemInput[]
  coupon?: string
  locale: Locale | string
  req?: any
}

export const MANUAL_SALES_CHANNELS = [
  'phone',
  'in_person',
  'whatsapp',
  'instagram',
  'other',
] as const

export type ManualSalesChannel = (typeof MANUAL_SALES_CHANNELS)[number]

/**
 * Input exclusivo do fluxo administrativo. Mantém email opcional sem
 * enfraquecer o contrato do checkout público (`CreateOrderInput`).
 */
export interface CreateManualOrderInput {
  checkoutRequestId: string
  customer: ManualOrderCustomerInput
  shippingAddress: OrderAddressInput
  billingSameAsShipping: boolean
  billingAddress?: OrderAddressInput
  items: OrderItemInput[]
  coupon?: string
  locale: Locale | string
  salesChannel: ManualSalesChannel
  internalNote?: string
  req?: any
}

export interface ManualOrderPreview {
  items: Array<{
    flowerId: number
    name: string
    qty: number
    price: number
    lineTotal: number
  }>
  subtotal: number
  discount: number
  shippingCost: number | null
  total: number | null
  orderStatus: 'pending_payment' | 'awaiting_shipping'
}

// ─── OrderAddressSnapshot ─────────────────────────────────────

export interface OrderAddressSnapshot {
  recipientName: string
  phone?: string | null
  line1: string
  line2?: string | null
  city: string
  region?: string | null
  postalCode?: string | null
  country: string
}

// ─── OrderItemSnapshot (calculado server-side) ────────────────

export interface OrderItemSnapshot {
  flower: number
  name: string
  price: number
  qty: number
  lineTotal: number
  productionMode?: string | null
}

// ─── Resultado ────────────────────────────────────────────────

export interface CreateOrderResult {
  order: any // Order from Payload create
}

// ─── Erros ────────────────────────────────────────────────────

export class OrderValidationError extends Error {
  code = 'ORDER_VALIDATION_ERROR' as const
  details: string[]
  constructor(details: string[]) {
    super(details.join('; '))
    this.details = details
  }
}

export class InvalidProductError extends Error {
  code = 'INVALID_PRODUCT' as const
  constructor(msg = 'Produto inválido.') { super(msg) }
}

export class CouponValidationError extends Error {
  code = 'COUPON_VALIDATION_ERROR' as const
  constructor(msg = 'Cupão inválido para esta encomenda.') { super(msg) }
}

export class IdempotencyConflictError extends Error {
  code = 'IDEMPOTENCY_CONFLICT' as const
  constructor(msg = 'Conflito de idempotência.') { super(msg) }
}
