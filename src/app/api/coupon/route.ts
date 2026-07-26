import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { validateCoupon } from '@/lib/coupon'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = (searchParams.get('code') || '').trim()
  const email = (searchParams.get('email') || '').trim().toLowerCase()
  const subtotal = parseFloat(searchParams.get('subtotal') || '0')

  if (!code) return NextResponse.json({ valid: false, error: 'Sem código.' })

  const payload = await getPayload({ config })
  const result = await validateCoupon(payload, code, email, subtotal)

  if (result.valid) {
    return NextResponse.json({ valid: true, discount: result.discount, type: result.type, value: result.value })
  }

  return NextResponse.json({ valid: false, error: result.error })
}