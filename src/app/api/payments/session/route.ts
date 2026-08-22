/**
 * POST /api/payments/session — Cria/reutiliza PaymentIntent para pagamento
 *
 * Input permitido: { orderNumber, checkoutRequestId }
 * NUNCA aceita amount, currency, shippingCost do browser.
 *
 * Fluxo:
 * 1. Validar formato do input
 * 2. Localizar Order pelo orderNumber
 * 3. Verificar checkoutRequestHash contra SHA-256(checkoutRequestId)
 * 4. Se não coincidir → resposta segura 404 (não revela dados)
 * 5. Order tem de estar pending_payment
 * 6. Chamar createPaymentForOrder()
 * 7. Devolver { clientSecret } (nunca persistido na BD)
 *
 * Order draft → ORDER_NOT_READY_FOR_PAYMENT (shipping não disponível)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import crypto from 'crypto'
import { createPaymentForOrder } from '@/services/payments/payments'
import { InvalidOrderForPaymentError, PaymentError, PaymentReservationExpiredError } from '@/services/payments/payment-types'
import { prepareOrderForPayment } from '@/services/checkout-finalization'

// ─── Input validation ─────────────────────────────────────

interface PaymentSessionInput {
  orderNumber: string
  checkoutRequestId: string
}

function validateInput(body: unknown): PaymentSessionInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Corpo do pedido inválido.')
  }

  const obj = body as Record<string, unknown>
  const orderNumber = typeof obj.orderNumber === 'string' && obj.orderNumber.length > 0
    ? obj.orderNumber.trim()
    : null
  const checkoutRequestId = typeof obj.checkoutRequestId === 'string' && obj.checkoutRequestId.length > 0
    ? obj.checkoutRequestId.trim()
    : null

  if (!orderNumber) {
    throw new ValidationError('orderNumber é obrigatório.')
  }

  if (!checkoutRequestId) {
    throw new ValidationError('checkoutRequestId é obrigatório.')
  }

  return { orderNumber, checkoutRequestId }
}

class ValidationError extends Error {
  code = 'VALIDATION_ERROR' as const
  constructor(msg: string) {
    super(msg)
    this.name = 'ValidationError'
  }
}

// ─── Session response type ────────────────────────────────

interface SessionResponse {
  clientSecret: string
}

// ─── POST handler ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Corpo do pedido inválido. Envie JSON válido.' },
        { status: 400 },
      )
    }

    // 2. Validar input
    let input: PaymentSessionInput
    try {
      input = validateInput(body)
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 3. Localizar Order pelo orderNumber
    const findResult = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: input.orderNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const order = findResult.docs[0] as any

    if (!order || !order.id) {
      // Resposta segura — não revela existência da Order
      return NextResponse.json(
        { error: 'Encomenda não encontrada.' },
        { status: 404 },
      )
    }

    // Encomendas manuais usam exclusivamente o bearer token temporário.
    // Nunca reutilizar checkoutRequestHash como autorização desse fluxo.
    if (order.orderSource === 'manual') {
      return NextResponse.json(
        { error: 'Encomenda não encontrada.' },
        { status: 404 },
      )
    }

    // 4. Verificar checkoutRequestHash
    const expectedHash = crypto
      .createHash('sha256')
      .update(input.checkoutRequestId)
      .digest('hex')

    if (order.checkoutRequestHash !== expectedHash) {
      // checkoutRequestId errado — resposta segura, sem leak
      return NextResponse.json(
        { error: 'Encomenda não encontrada.' },
        { status: 404 },
      )
    }

    // 5. Validar estado da Order — se draft, finalizar primeiro
    if (order.orderStatus === 'draft') {
      try {
        const prepared = await prepareOrderForPayment(payload, {
          orderId: order.id,
        })

        // Se cupula (awaiting_shipping), retornar erro específico
        if (prepared.order.orderStatus === 'awaiting_shipping') {
          return NextResponse.json(
            {
              error: 'Encomenda com cúpula — portes de envio a confirmar após a reserva. Pagamento não disponível até confirmação manual.',
              code: 'CUPULA_SHIPPING_NEEDS_CONFIRMATION',
            },
            { status: 400 },
          )
        }

        // Order está agora pending_payment — continuar para criar PaymentIntent
        // Atualizar order local para a versão fresca
        Object.assign(order, prepared.order)
      } catch (prepareErr: any) {
        console.error('[payments/session] prepareOrderForPayment error:', prepareErr)
        return NextResponse.json(
          { error: prepareErr.message || 'Erro ao preparar encomenda para pagamento.' },
          { status: 400 },
        )
      }
    }

    if (order.orderStatus !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Esta encomenda não pode ser paga (estado inválido).' },
        { status: 400 },
      )
    }

    if (
    order.orderStatus === 'pending_payment' &&
    order.paymentStatus === 'paid'
  ) {
    // Já paga — devolver clientSecret se existir
    return NextResponse.json({
      clientSecret: order.stripePaymentIntentId ? null : null,
    })
  }

  // 6. Verificar reservas activas (ISSUE-1I) ─────────────────
  const items = (order.items as any[]) || []
  const hasReservableItem = items.some((item: any) => {
    const mode = item.productionMode
    return mode === 'unique' || mode === 'reproducible' || mode === null || mode === undefined
  })

  if (hasReservableItem) {
    const reservationsResult = await payload.find({
      collection: 'stock-reservations' as any,
      where: { order: { equals: order.id } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const reservations = reservationsResult.docs as any[]
    const now = new Date()

    for (const reservation of reservations) {
      const expiresAt = new Date(reservation.expiresAt)

      // confirmed é aceitável (Order já está consistente)
      if (reservation.status === 'confirmed') continue

      if (reservation.status === 'active' && expiresAt > now) continue

      // Qualquer outro estado (expired, released) ou active expirada → bloquear
      throw new PaymentReservationExpiredError(
        `Reserva ${reservation.id} (flowerId=${reservation.flower}) não está disponível (status=${reservation.status}).`,
      )
    }

    // Verificar se todas as reservas esperadas existem
    for (const item of items) {
      const mode = item.productionMode
      if (mode === 'made_to_order') continue

      const flowerId = typeof item.flower === 'object' ? item.flower.id : item.flower
      const hasReservation = reservations.some((r: any) => {
        const rFlowerId = typeof r.flower === 'object' ? r.flower.id : r.flower
        return rFlowerId === flowerId
      })

      if (!hasReservation) {
        throw new PaymentReservationExpiredError(
          `Item flowerId=${flowerId} não tem reserva associada.`,
        )
      }
    }
  }

  // 7. Criar/reutilizar PaymentIntent via serviço existente
    const outcome = await createPaymentForOrder(payload, {
      orderId: order.id,
      idempotencyKey: crypto
        .createHash('sha256')
        .update(`payment:${order.checkoutAttemptId || input.checkoutRequestId}`)
        .digest('hex'),
    })

    // 7. Devolver apenas o clientSecret (nunca guardado na BD)
      return NextResponse.json({
        clientSecret: outcome.clientSecret ?? null,
      } satisfies { clientSecret: string | null })
  } catch (err: any) {
    if (err instanceof PaymentReservationExpiredError) {
      return NextResponse.json(
        { error: err.message, code: 'PAYMENT_RESERVATION_EXPIRED' },
        { status: 400 },
      )
    }

    if (err instanceof InvalidOrderForPaymentError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      )
    }

    if (err instanceof PaymentError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      )
    }

    console.error('[payments/session] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 },
    )
  }
}
