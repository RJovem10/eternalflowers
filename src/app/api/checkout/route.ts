/**
 * POST /api/checkout — Cria uma encomenda.
 *
 * Delega a lógica de domínio a createOrder() (services/orders.ts):
 * - Não confia em price/name/subtotal do frontend
 * - Não incrementa usesCount de cupões
 * - Idempotente via checkoutRequestId
 *
 * Input: CreateOrderInput (checkoutRequestId, customer, shippingAddress, items, coupon?, locale)
 * Output: { ok, orderId, orderNumber, subtotal, discount, shippingCost, total, orderStatus, paymentStatus }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { createOrder } from '@/services/orders'
import { prepareOrderForPayment } from '@/services/checkout-finalization'
import type { CreateOrderInput } from '@/services/order-types'
import {
  OrderValidationError,
  InvalidProductError,
  CouponValidationError,
  IdempotencyConflictError,
} from '@/services/order-types'

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'Corpo do pedido inválido. Envie JSON válido.',
          error_code: 'INVALID_JSON',
        },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // Mapear input do body para CreateOrderInput
    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : []
    const items = rawItems
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
      .map((i) => ({
        flowerId: Number(i.flowerId) || 0,
        qty: Number(i.qty) || 0,
      }))

    const input: CreateOrderInput = {
      checkoutRequestId: asString(body.checkoutRequestId) || '',
      customer: asObject(body.customer) as unknown as CreateOrderInput['customer'],
      shippingAddress: asObject(body.shippingAddress) as unknown as CreateOrderInput['shippingAddress'],
      billingSameAsShipping: body.billingSameAsShipping !== false,
      billingAddress: asObject(body.billingAddress) as unknown as CreateOrderInput['billingAddress'] | undefined,
      items,
      coupon: asString(body.coupon) || undefined,
      locale: asString(body.locale) || 'pt',
      req: (req as any).payload ? { payload: (req as any).payload } : undefined,
    }

    const result = await createOrder(payload, input)

    let order = result.order

    // ════════════════════════════════════════════════════════
    // Server-side order preparation (F5 — ISSUE-1Q)
    // ════════════════════════════════════════════════════════
    // If the order is still draft, call prepareOrderForPayment
    // immediately so reservations are created and shipping is
    // calculated server-side. The browser must never trigger
    // this independently.
    if (order.orderStatus === 'draft') {
      const prepared = await prepareOrderForPayment(payload, {
        orderId: order.id,
      })
      order = prepared.order
    }

    return NextResponse.json(
      {
        ok: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingCost: order.shippingCost ?? null,
        total: order.total ?? null,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      },
      { status: 201 },
    )
  } catch (err: any) {
    return handleError(err)
  }
}

// ─── Error handling ─────────────────────────────────────────

function handleError(err: any): NextResponse {
  if (err instanceof OrderValidationError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        error_code: 'ORDER_VALIDATION_ERROR',
        details: err.details,
      },
      { status: 400 },
    )
  }

  if (err instanceof InvalidProductError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Produto inválido.',
        error_code: 'INVALID_PRODUCT',
      },
      { status: 404 },
    )
  }

  if (err instanceof CouponValidationError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Cupão inválido.',
        error_code: 'COUPON_VALIDATION_ERROR',
      },
      { status: 400 },
    )
  }

  if (err instanceof IdempotencyConflictError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Conflito de idempotência.',
        error_code: 'IDEMPOTENCY_CONFLICT',
      },
      { status: 409 },
    )
  }

  // Erro inesperado — sem detalhes internos
  console.error('[checkout] Unexpected error:', err)
  return NextResponse.json(
    {
      ok: false,
      error: 'Erro interno do servidor.',
      error_code: 'INTERNAL_ERROR',
    },
    { status: 500 },
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}