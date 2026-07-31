'use client'

import Link from 'next/link'
import { useCart } from '@/components/CartProvider'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { getDictionary } from '@/i18n/dictionaries'
import { couponErrorToDictKey, type CouponErrorCode } from '@/lib/coupon'

export default function Checkout() {
  const { locale } = useParams() as { locale: string }
  const dict = getDictionary(locale)
  const { items, count, coupon, clear } = useCart()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)

  async function submit() {
    if (!email) { setError(dict.email + ' ' + dict.required); return }
    setBusy(true)
    setError('')
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, items, coupon, locale, subtotal }),
    })
    const data = await res.json()
    setBusy(false)
    if (data.ok) {
      clear()
      router.push(`/${locale}/thank-you`)
    } else {
      const errorKey = data.error_code ? couponErrorToDictKey[data.error_code as CouponErrorCode] : null
      setError(errorKey ? dict[errorKey as keyof typeof dict] : data.error || dict.orderError)
    }
  }

  if (count === 0) {
    return <div className="py-10 text-center text-stone-500">{dict.emptyCart}</div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link
        href={`/${locale}/cart`}
        className="inline-flex text-xs uppercase tracking-[0.18em] text-brand-charcoal/50 transition-colors hover:text-brand-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
      >
        ← {dict.backToCart}
      </Link>
      <h1 className="text-2xl font-semibold">{dict.checkout}</h1>
      <div>
        <label className="block text-sm font-medium mb-1">{dict.name}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={dict.namePlaceholder}
          aria-label={dict.name}
          className="w-full border border-stone-300 rounded px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{dict.email}</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={dict.emailPlaceholder}
          aria-label={dict.email}
          className="w-full border border-stone-300 rounded px-3 py-2" />
      </div>
      <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-1">
        {items.map((i) => (
          <div key={i.id} className="flex justify-between text-sm">
            <span>{i.name} × {i.qty}</span><span>{(i.price * i.qty).toFixed(2)} €</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold border-t pt-2 mt-2">
          <span>{dict.total}</span><span>{subtotal.toFixed(2)} €</span>
        </div>
      </div>
      {coupon && <p className="text-sm text-emerald-700">{dict.coupon}: {coupon}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full bg-rose-600 text-white py-3 rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50"
      >
        {busy ? dict.processing : dict.completeOrder}
      </button>
    </div>
  )
}
