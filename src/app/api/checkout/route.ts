import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { validateCoupon } from '@/lib/coupon'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, name, items, coupon, locale, subtotal } = body

  if (!email || !items?.length)
    return NextResponse.json({ ok: false, error: 'Dados incompletos.' })

  const payload = await getPayload({ config })

  // valida e aplica cupão (se houver)
  let discount = 0
  let appliedCoupon: any = null
  if (coupon) {
    const result = await validateCoupon(payload, coupon, email, subtotal)
    if (result.valid && result.coupon) {
      discount = result.discount ?? 0
      appliedCoupon = result.coupon
      // incrementa contador de usos
      await payload.update({
        collection: 'coupons',
        id: appliedCoupon.id,
        data: { usesCount: (appliedCoupon.usesCount || 0) + 1 },
      })
    }
  }

  const total = Math.max(0, Number((subtotal - discount).toFixed(2)))

  // cria encomenda (status pending — pagamento Stripe entra depois)
  const order = await payload.create({
    collection: 'orders',
    data: {
      email: email.toLowerCase(),
      items: items.map((i: any) => ({ flower: i.id, name: i.name, price: i.price, qty: i.qty })),
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      total,
      coupon: coupon || null,
      status: 'pending',
      locale: locale || 'pt',
    },
  })

  // NOTA: integração Stripe (MB WAY/Multibanco) entra aqui quando confirmada a conta PT.
  // Por agora a encomenda fica registada e a Marina trata do pagamento manualmente.

  return NextResponse.json({ ok: true, orderId: (order as any).id, total })
}
