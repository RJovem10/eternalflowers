import type { Payload } from 'payload'

export async function validateCoupon(
  payload: Payload,
  code: string,
  email?: string,
  subtotal?: number,
): Promise<{
  valid: boolean
  discount?: number
  type?: 'percent' | 'fixed'
  value?: number
  coupon?: unknown
  error?: string
}> {
  if (!code) return { valid: false, error: 'Sem código.' }

  const res = await payload.find({
    collection: 'coupons',
    where: { code: { equals: code.toUpperCase() }, active: { equals: true } },
    limit: 1,
  })

  const c = res.docs[0] as any
  if (!c) return { valid: false, error: 'Cupão inválido.' }

  const now = new Date()

  if (c.validFrom && new Date(c.validFrom) > now)
    return { valid: false, error: 'Ainda não ativo.' }
  if (c.validUntil && new Date(c.validUntil) < now)
    return { valid: false, error: 'Expirado.' }
  if (c.minOrder && (subtotal ?? 0) < c.minOrder)
    return { valid: false, error: `Mínimo ${c.minOrder} €.` }
  if (c.maxUses && c.usesCount >= c.maxUses)
    return { valid: false, error: 'Esgotado.' }
  if (c.firstOrderOnly && email) {
    const prior = await payload.find({
      collection: 'orders',
      where: { email: { equals: email }, status: { in: ['paid', 'pending'] } },
      limit: 1,
    })
    if (prior.docs.length > 0)
      return { valid: false, error: 'Só 1ª compra.' }
  }

  const discount =
    c.type === 'percent'
      ? ((subtotal ?? 0) * c.value) / 100
      : Math.min(c.value, subtotal ?? 0)

  return {
    valid: true,
    discount: Number(discount.toFixed(2)),
    type: c.type,
    value: c.value,
    coupon: c,
  }
}