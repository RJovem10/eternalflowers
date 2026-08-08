/**
 * stripe-client.ts — Cliente Stripe para o frontend
 *
 * Cria loadStripe fora do render React.
 * Se NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY não estiver definida,
 * a stripe instance é null e o checkout mostra estado de
 * configuração indisponível.
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) {
    return Promise.resolve(null)
  }

  if (!stripePromise) {
    stripePromise = loadStripe(key)
  }

  return stripePromise
}