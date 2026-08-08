'use client'

import { useState, useCallback, useRef } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'

// ─── Props ────────────────────────────────────────────────

interface StripePaymentSectionProps {
  orderNumber: string
  checkoutRequestId: string
  locale: string
  dict: {
    payNow: string
    processing: string
    paymentError: string
    paymentTryAgain: string
    stripeNotConfigured: string
    amount: string
    loading: string
  }
}

// ─── Inner form (tem acesso a useStripe/useElements) ──────

function PaymentForm({
  orderNumber,
  checkoutRequestId,
  locale,
  dict,
}: {
  orderNumber: string
  checkoutRequestId: string
  locale: string
  dict: StripePaymentSectionProps['dict']
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const submittedRef = useRef(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!stripe || !elements || submittedRef.current) {
        return
      }

      submittedRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const returnUrl = `${window.location.origin}/${locale}/checkout/payment-result`

        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: returnUrl,
          },
        })

        if (confirmError) {
          setError(confirmError.message || dict.paymentError)
          submittedRef.current = false
          setIsLoading(false)
        }
        // Se confirmPayment retornar sem erro, o browser redirecciona
        // para return_url — nada mais a fazer aqui
      } catch {
        setError(dict.paymentError)
        submittedRef.current = false
        setIsLoading(false)
      }
    },
    [stripe, elements, orderNumber, checkoutRequestId, locale, dict],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: {
            type: 'accordion',
            defaultCollapsed: false,
            spacedAccordionItems: false,
          } as any,
        }}
      />

      {error && (
        <p className="text-sm text-rose-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        className="w-full bg-rose-600 text-white py-3 rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? dict.processing : dict.payNow}
      </button>
    </form>
  )
}

// ─── Wrapper que carrega Stripe Elements ──────────────────

export default function StripePaymentSection(props: StripePaymentSectionProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Verificar se Stripe está configurado
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        {props.dict.stripeNotConfigured}
      </div>
    )
  }

  const handleStartPayment = useCallback(async () => {
    if (loadingSession) return
    if (clientSecret) return // já carregado

    setLoadingSession(true)
    setSessionError(null)

    try {
      const res = await fetch('/api/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: props.orderNumber,
          checkoutRequestId: props.checkoutRequestId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSessionError(data.error || props.dict.paymentError)
        setLoadingSession(false)
        return
      }

      setClientSecret(data.clientSecret)
    } catch {
      setSessionError(props.dict.paymentError)
    }

    setLoadingSession(false)
  }, [props.orderNumber, props.checkoutRequestId, props.dict, clientSecret, loadingSession])

  // Se ainda não temos clientSecret, mostrar botão para iniciar pagamento
  if (!clientSecret) {
    return (
      <div className="space-y-3">
        {sessionError && (
          <p className="text-sm text-rose-600 text-center">{sessionError}</p>
        )}
        <button
          onClick={handleStartPayment}
          disabled={loadingSession}
          className="w-full bg-rose-600 text-white py-3 rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loadingSession ? props.dict.loading : props.dict.payNow}
        </button>
      </div>
    )
  }

  // Temos clientSecret — montar Payment Element
  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <PaymentForm
        orderNumber={props.orderNumber}
        checkoutRequestId={props.checkoutRequestId}
        locale={props.locale}
        dict={props.dict}
      />
    </Elements>
  )
}