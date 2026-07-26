'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CartItem = {
  id: string
  name: string
  price: number
  qty: number
  image?: string | null
}

type CartCtx = {
  items: CartItem[]
  count: number
  add: (item: CartItem) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
  coupon: string | null
  setCoupon: (c: string | null) => void
}

const Ctx = createContext<CartCtx | null>(null)
const STORAGE_KEY = 'floresmarina_cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [coupon, setCoupon] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setItems(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])

  const add = (item: CartItem) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === item.id)
      if (found) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, item]
    })
  }

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))

  const setQty = (id: string, qty: number) =>
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))
    )

  const clear = () => {
    setItems([])
    setCoupon(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])

  const value: CartCtx = { items, count, add, remove, setQty, clear, coupon, setCoupon }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export default CartProvider
