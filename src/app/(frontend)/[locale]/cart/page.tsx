'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/components/CartProvider'
import { useParams, useRouter } from 'next/navigation'
import { getDictionary } from '@/i18n/dictionaries'
import { couponErrorToDictKey, type CouponErrorCode, type CouponErrorDictKey } from '@/lib/coupon'

export default function Cart() {
  const { locale } = useParams() as { locale: string }
  const dict = getDictionary(locale)
  const { items, count, remove, setQty, coupon, setCoupon } = useCart()
  const router = useRouter()
  const [code, setCode] = useState(coupon || '')
  const [msg, setMsg] = useState('')

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)

  async function applyCoupon() {
    const c = code.trim().toUpperCase()
    if (!c) return
    const res = await fetch(`/api/coupon?code=${encodeURIComponent(c)}&email=&subtotal=${subtotal}`)
    const data = await res.json()
    if (data.valid) {
      setCoupon(c)
      setMsg('✓ ' + dict.couponApplied)
    } else {
      setCoupon(null)
      const errCode: CouponErrorCode = data.error_code
      const errorKey: CouponErrorDictKey | null = errCode ? couponErrorToDictKey[errCode] : null
      const errorMsg = errorKey ? dict[errorKey] : (data.error || dict.invalidCoupon)
      setMsg('✗ ' + errorMsg)
    }
  }

  if (count === 0) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-brand-charcoal/60">{dict.emptyCart}</p>
        <Link
          href={`/${locale}/catalog`}
          className="inline-flex text-sm font-medium text-brand-gold-dark underline decoration-brand-gold/40 underline-offset-4 transition-colors hover:text-brand-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
        >
          {dict.continueShopping}
        </Link>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-3">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-4 bg-white border border-stone-200 rounded-lg p-3">
            <div className="w-16 h-16 bg-stone-100 rounded flex items-center justify-center text-2xl">🌷</div>
            <div className="flex-1">
              <p className="font-medium">{i.name}</p>
              <p className="text-rose-700 text-sm">{i.price.toFixed(2)} €</p>
            </div>
            <input
              type="number" min={1} value={i.qty}
              onChange={(e) => setQty(i.id, parseInt(e.target.value) || 1)}
              aria-label={`${dict.qtyLabel} — ${i.name}`}
              className="w-16 border border-stone-300 rounded px-2 py-1 text-center"
            />
            <button onClick={() => remove(i.id)} aria-label={`${dict.removeLabel} — ${i.name}`} className="text-stone-400 hover:text-rose-600 text-sm">✕</button>
          </div>
        ))}
      </div>
      <div className="bg-white border border-stone-200 rounded-lg p-4 h-fit space-y-3">
        <div className="flex justify-between font-semibold">
          <span>{dict.subtotal}</span><span>{subtotal.toFixed(2)} €</span>
        </div>
        <div className="flex gap-2">
          <input
            value={code} onChange={(e) => setCode(e.target.value)} placeholder={dict.couponPlaceholder}
            aria-label={dict.couponLabel}
            className="flex-1 border border-stone-300 rounded px-2 py-1 text-sm uppercase"
          />
          <button onClick={applyCoupon} className="bg-stone-800 text-white px-3 py-1 rounded text-sm">{dict.applyCoupon}</button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <button
          onClick={() => router.push(`/${locale}/checkout`)}
          className="w-full bg-rose-600 text-white py-2 rounded-lg font-medium hover:bg-rose-700"
        >
          {dict.checkout}
        </button>
      </div>
    </div>
  )
}
