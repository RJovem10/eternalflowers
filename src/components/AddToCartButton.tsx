'use client'

import { useEffect, useState } from 'react'
import { useCart } from './CartProvider'

export default function AddToCartButton({
  item,
  dict,
  disabled,
}: {
  item: any
  dict: any
  disabled?: boolean
}) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!added) return

    const timeout = setTimeout(() => setAdded(false), 2500)
    return () => clearTimeout(timeout)
  }, [added])

  if (disabled) {
    return (
      <button
        disabled
        className="cursor-not-allowed bg-brand-charcoal/20 px-6 py-3 font-medium text-brand-charcoal/50"
      >
        {dict.sold}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => {
          add(item)
          setAdded(true)
        }}
        disabled={added}
        className="bg-brand-gold px-6 py-3 font-medium text-white transition-colors duration-300 hover:bg-brand-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {added ? `${dict.addedToCart} ✓` : dict.addToCart}
      </button>
      <div aria-live="polite" className="sr-only">
        {added ? dict.addedToCart : ''}
      </div>
    </>
  )
}
