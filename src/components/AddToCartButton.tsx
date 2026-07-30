'use client'

import { useCart } from './CartProvider'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

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
    <button
      onClick={() => add(item)}
      className="bg-brand-gold px-6 py-3 font-medium text-white transition-colors duration-300 hover:bg-brand-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold-dark"
    >
      {dict.addToCart}
    </button>
  )
}
