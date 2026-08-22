'use client'

import { useEffect, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'

export const MANUAL_PAYMENT_SESSION_TOKEN_KEY = 'eternalflowers-manual-payment-token'

export default function PaymentLinkSection({ locale }: { locale: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const tokenFromHash = hash.startsWith('token=')
      ? new URLSearchParams(hash).get('token')
      : hash
    const resolved = tokenFromHash || window.sessionStorage.getItem(MANUAL_PAYMENT_SESSION_TOKEN_KEY)
    if (tokenFromHash) {
      window.sessionStorage.setItem(MANUAL_PAYMENT_SESSION_TOKEN_KEY, tokenFromHash)
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
    if (!resolved) {
      setError('Este link de pagamento é inválido ou está incompleto.')
      setLoading(false)
      return
    }
    setToken(resolved)

    void fetch('/api/payments/link-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resolved }),
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || !data.clientSecret) {
          throw new Error(data.error || 'Não foi possível iniciar o pagamento.')
        }
        setClientSecret(data.clientSecret)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return <PaymentMessage text="O pagamento online não está configurado." />
  }
  if (loading) return <PaymentMessage text="A preparar o pagamento seguro…" />
  if (error || !clientSecret || !token) {
    return <PaymentMessage text={error || 'Este link de pagamento não está disponível.'} error />
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <PaymentLinkForm locale={locale} />
    </Elements>
  )
}

function PaymentLinkForm({ locale }: { locale: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/pagar/resultado`,
      },
    })
    if (result.error) {
      setError(result.error.message || 'Não foi possível concluir o pagamento.')
      setSubmitting(false)
      return
    }
    window.sessionStorage.removeItem(MANUAL_PAYMENT_SESSION_TOKEN_KEY)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement options={{ layout: { type: 'accordion', defaultCollapsed: false } as any }} />
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-lg bg-rose-600 px-5 py-3 font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'A processar…' : 'Pagar agora'}
      </button>
      <p className="text-center text-xs text-stone-500">
        O pagamento é processado de forma segura pelo Stripe.
      </p>
    </form>
  )
}

function PaymentMessage({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${error
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-stone-200 bg-stone-50 text-stone-700'}`}>
      {text}
    </div>
  )
}
