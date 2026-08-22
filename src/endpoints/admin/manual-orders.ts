import {
  canAccessAdmin,
  type PayloadHandler,
  type PayloadRequest,
} from 'payload'
import type { CreateManualOrderInput } from '@/services/order-types'
import {
  CouponValidationError,
  IdempotencyConflictError,
  InvalidProductError,
  OrderValidationError,
} from '@/services/order-types'
import { createManualOrder, previewManualOrder } from '@/services/orders'
import { prepareOrderForPayment } from '@/services/checkout-finalization'
import {
  confirmExternalPayment,
} from '@/services/payments/manual-payments'
import {
  EXTERNAL_PAYMENT_METHODS,
  PaymentSettlementConflictError,
  SettlementStockUnavailableError,
  type ExternalPaymentMethod,
} from '@/services/payments/payment-settlement'
import { issueManualPaymentLink, PaymentLinkError } from '@/services/payments/payment-links'
import {
  confirmCupulaShippingQuote,
  CupulaShippingConfirmationError,
} from '@/services/cupula-shipping'

const MANUAL_RESERVATION_DURATION_MS = 24 * 60 * 60 * 1000

export const previewManualOrderHandler: PayloadHandler = async (req) => {
  const authError = await requireAdmin(req)
  if (authError) return authError
  try {
    const body = await readBody(req)
    const quote = await previewManualOrder(req.payload, mapManualInput(body, req))
    return json({ ok: true, quote })
  } catch (error) {
    return manualOrderError(error, 'preview')
  }
}

export const createManualOrderHandler: PayloadHandler = async (req) => {
  const authError = await requireAdmin(req)
  if (authError) return authError
  try {
    const body = await readBody(req)
    const input = mapManualInput(body, req)
    const paymentChoice = body.paymentChoice === 'external' ? 'external' : 'stripe'
    const created = await createManualOrder(req.payload, input)
    let order = created.order as any

    if (order.orderStatus === 'draft') {
      const prepared = await prepareOrderForPayment(req.payload, {
        orderId: Number(order.id),
        reservationDurationMs: MANUAL_RESERVATION_DURATION_MS,
        req,
      })
      order = prepared.order
    }

    let paymentLink: string | null = null
    let paymentLinkExpiresAt: string | null = null
    if (order.orderStatus === 'pending_payment' && paymentChoice === 'external') {
      const external = asObject(body.externalPayment)
      const method = asExternalMethod(external?.method)
      const settled = await confirmExternalPayment(req.payload, {
        orderId: Number(order.id),
        method,
        reference: asString(external?.reference) || undefined,
        confirmed: external?.confirmed === true,
        confirmedBy: req.user!.id,
        req,
      })
      order = await req.payload.findByID({
        collection: 'orders', id: settled.orderId, depth: 0, req, overrideAccess: true,
      })
    } else if (order.orderStatus === 'pending_payment' && paymentChoice === 'stripe') {
      const issued = await issueManualPaymentLink(req.payload, {
        orderId: Number(order.id),
        issuedBy: req.user!.id,
        req,
      })
      paymentLink = buildPublicPaymentURL(req, order.locale || 'pt', issued.token)
      paymentLinkExpiresAt = issued.expiresAt
    }

    return json({
      ok: true,
      order: publicOrderResult(order),
      paymentLink,
      paymentLinkExpiresAt,
    }, 201)
  } catch (error) {
    return manualOrderError(error, 'create')
  }
}

export const confirmManualPaymentHandler: PayloadHandler = async (req) => {
  const authError = await requireAdmin(req)
  if (authError) return authError
  try {
    const orderId = getOrderId(req)
    const body = await readBody(req)
    const result = await confirmExternalPayment(req.payload, {
      orderId,
      method: asExternalMethod(body.method),
      reference: asString(body.reference) || undefined,
      confirmed: body.confirmed === true,
      confirmedBy: req.user!.id,
      req,
    })
    return json({ ok: true, ...result })
  } catch (error) {
    return manualOrderError(error, 'manual-payment')
  }
}

export const issuePaymentLinkHandler: PayloadHandler = async (req) => {
  const authError = await requireAdmin(req)
  if (authError) return authError
  try {
    // Exigir JSON mesmo sem parâmetros mantém a ação fora do alcance de
    // submissões HTML simples; o servidor continua a não aceitar valores.
    await readBody(req)
    const orderId = getOrderId(req)
    const order = await req.payload.findByID({
      collection: 'orders', id: orderId, depth: 0, req, overrideAccess: true,
    }) as any
    const issued = await issueManualPaymentLink(req.payload, {
      orderId,
      issuedBy: req.user!.id,
      req,
    })
    return json({
      ok: true,
      paymentLink: buildPublicPaymentURL(req, order.locale || 'pt', issued.token),
      expiresAt: issued.expiresAt,
    })
  } catch (error) {
    return manualOrderError(error, 'payment-link')
  }
}

export const confirmShippingHandler: PayloadHandler = async (req) => {
  const authError = await requireAdmin(req)
  if (authError) return authError
  try {
    const orderId = getOrderId(req)
    const body = await readBody(req)
    const quotedShippingCost = Number(body.quotedShippingCost)
    if (!Number.isFinite(quotedShippingCost)) {
      throw new CupulaShippingConfirmationError('Valor de portes inválido.')
    }
    const result = await confirmCupulaShippingQuote(req.payload, {
      orderId,
      quoteAmountCents: Math.round(quotedShippingCost * 100),
      reference: asString(body.reference) || undefined,
      confirmed: body.confirmed === true,
      confirmedBy: req.user!.id,
      req,
    })
    return json({ ok: true, kind: result.kind, order: publicOrderResult(result.order) })
  } catch (error) {
    return manualOrderError(error, 'shipping')
  }
}

async function requireAdmin(req: PayloadRequest): Promise<Response | null> {
  if (!req.user) return json({ ok: false, error: 'Autenticação necessária.' }, 401)
  try {
    await canAccessAdmin({ req })
    return null
  } catch {
    return json({ ok: false, error: 'Sem permissão para esta ação.' }, 403)
  }
}

async function readBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json?.()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body as Record<string, unknown>
  } catch {
    throw new OrderValidationError(['Corpo do pedido inválido. Envie JSON válido.'])
  }
}

function mapManualInput(body: Record<string, unknown>, req: PayloadRequest): CreateManualOrderInput {
  const rawItems = Array.isArray(body.items) ? body.items : []
  const items = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({ flowerId: Number(item.flowerId) || 0, qty: Number(item.qty) || 0 }))

  return {
    checkoutRequestId: asString(body.requestId) || '',
    salesChannel: asString(body.salesChannel) as CreateManualOrderInput['salesChannel'],
    customer: (asObject(body.customer) || {}) as unknown as CreateManualOrderInput['customer'],
    shippingAddress: (asObject(body.shippingAddress) || {}) as unknown as CreateManualOrderInput['shippingAddress'],
    billingSameAsShipping: body.billingSameAsShipping !== false,
    billingAddress: (asObject(body.billingAddress) || undefined) as unknown as CreateManualOrderInput['billingAddress'],
    items,
    coupon: asString(body.coupon) || undefined,
    internalNote: asString(body.internalNote) || undefined,
    locale: asString(body.locale) || 'pt',
    req,
  }
}

function asExternalMethod(value: unknown): ExternalPaymentMethod {
  if (typeof value === 'string' && EXTERNAL_PAYMENT_METHODS.includes(value as ExternalPaymentMethod)) {
    return value as ExternalPaymentMethod
  }
  throw new PaymentSettlementConflictError('Método de pagamento externo inválido.')
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asObject(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null
}

function getOrderId(req: PayloadRequest): number {
  const value = (req.routeParams as any)?.id
  const orderId = Number(value)
  if (!Number.isInteger(orderId) || orderId < 1) {
    throw new OrderValidationError(['ID de encomenda inválido.'])
  }
  return orderId
}

function publicOrderResult(order: any) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingCost: order.shippingCost ?? null,
    total: order.total ?? null,
  }
}

function buildPublicPaymentURL(req: PayloadRequest, locale: string, token: string): string {
  const configured = String(req.payload.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/$/, '')
  let origin = configured
  if (!origin) {
    try { origin = new URL(req.url || '').origin } catch { origin = '' }
  }
  const safeLocale = ['pt', 'en', 'es', 'it', 'de'].includes(locale) ? locale : 'pt'
  return `${origin}/${safeLocale}/pagar#token=${encodeURIComponent(token)}`
}

function manualOrderError(error: unknown, stage: string): Response {
  if (error instanceof OrderValidationError) {
    return json({ ok: false, error: error.message, code: error.code, details: error.details }, 400)
  }
  if (error instanceof InvalidProductError) {
    return json({ ok: false, error: error.message, code: error.code }, 404)
  }
  if (error instanceof CouponValidationError) {
    return json({ ok: false, error: error.message, code: error.code }, 400)
  }
  if (error instanceof IdempotencyConflictError) {
    return json({ ok: false, error: error.message, code: error.code }, 409)
  }
  if (
    error instanceof PaymentSettlementConflictError ||
    error instanceof SettlementStockUnavailableError ||
    error instanceof PaymentLinkError ||
    error instanceof CupulaShippingConfirmationError
  ) {
    return json({ ok: false, error: error.message, code: (error as any).code }, 409)
  }
  console.error(`[orders/manual] stage=${stage} unexpected:`,
    error instanceof Error ? error.message : 'unknown')
  return json({ ok: false, error: 'Erro interno do servidor.' }, 500)
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
