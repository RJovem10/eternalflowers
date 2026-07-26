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
      <button disabled className="bg-stone-300 text-white px-6 py-3 rounded-lg cursor-not-allowed">
        {dict.sold}
      </button>
    )
  }

  return (
    <button
      onClick={() => add(item)}
      className="bg-rose-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-rose-700"
    >
      {dict.addToCart}
    </button>
  )
}
