import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  createPaymentSessionFromLink,
  PaymentLinkError,
} from '@/services/payments/payment-links'
import { PaymentError } from '@/services/payments/payment-types'

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Link de pagamento inválido.' }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Link de pagamento inválido.' }, 400)
  }
  const data = body as Record<string, unknown>
  if (['amount', 'currency', 'total', 'shippingCost', 'orderId'].some((key) => key in data)) {
    return json({ error: 'O pedido contém campos não permitidos.' }, 400)
  }
  const token = typeof data.token === 'string' ? data.token.trim() : ''
  if (!token) return json({ error: 'Link de pagamento inválido.' }, 400)

  try {
    const payload = await getPayload({ config })
    const result = await createPaymentSessionFromLink(payload, token)
    return json({ clientSecret: result.clientSecret }, 200)
  } catch (error) {
    if (error instanceof PaymentLinkError) {
      const status = error.code === 'PAYMENT_LINK_EXPIRED'
        ? 410
        : error.code === 'PAYMENT_LINK_NOT_ALLOWED' ? 409 : 404
      return json({ error: error.message, code: error.code }, status)
    }
    if (error instanceof PaymentError) {
      return json({ error: 'Não foi possível iniciar o pagamento.' }, 409)
    }
    console.error('[payments/link-session] Unexpected error:',
      error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Erro interno do servidor.' }, 500)
  }
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS })
}
