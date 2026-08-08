'use client'

import { Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { getStripe } from '@/lib/stripe-client'
import { getDictionary } from '@/i18n/dictionaries'

type PaymentResultStatus =
  | 'succeeded'
  | 'processing'
  | 'requires_payment_method'
  | 'unknown'
  | 'loading'
  | 'error'

function PaymentResultInner() {
  const searchParams = useSearchParams()
  const { locale } = useParams() as { locale: string }
  const dict = getDictionary(locale)
  const [status, setStatus] = useState<PaymentResultStatus>('loading')
  const [message, setMessage] = useState<string>('')
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const clientSecret = searchParams.get('payment_intent_client_secret')
    const redirectStatus = searchParams.get('redirect_status')

    if (!clientSecret || !redirectStatus) {
      setStatus('error')
      setMessage(dict.paymentResultError)
      return
    }

    // Mapear redirect_status para status interno
    switch (redirectStatus) {
      case 'succeeded':
        setStatus('succeeded')
        setMessage(dict.paymentResultSucceeded)
        break
      case 'processing':
        setStatus('processing')
        setMessage(dict.paymentResultProcessing)
        break
      case 'requires_payment_method':
        setStatus('requires_payment_method')
        setMessage(dict.paymentResultFailed)
        break
      default:
        setStatus('unknown')
        setMessage(dict.paymentResultUnknown)
    }

    // Opcional: recuperar estado do PaymentIntent para confirmação
    // (apenas para UX — webhook é fonte de verdade)
    const stripePromise = getStripe()
    if (stripePromise && clientSecret) {
      stripePromise.then((stripe) => {
        if (!stripe) return
        stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
          if (!paymentIntent) return
          if (paymentIntent.status === 'succeeded') {
            setStatus('succeeded')
            setMessage(dict.paymentResultSucceeded)
          } else if (paymentIntent.status === 'processing') {
            setStatus('processing')
            setMessage(dict.paymentResultProcessing)
          } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_action') {
            setStatus('requires_payment_method')
            setMessage(dict.paymentResultFailed)
          }
        })
      })
    }
  }, [searchParams, dict])

  const icon: Record<PaymentResultStatus, string> = {
    succeeded: '✅',
    processing: '⏳',
    requires_payment_method: '❌',
    unknown: 'ℹ️',
    loading: '⏳',
    error: '❌',
  }

  return (
    <div className="max-w-lg mx-auto py-10 text-center space-y-4">
      <div className="text-4xl">{icon[status]}</div>

      {status === 'loading' && (
        <p className="text-stone-500">{dict.processing}</p>
      )}

      {status !== 'loading' && (
        <>
          <h2 className="text-xl font-semibold text-emerald-800">
            {message}
          </h2>

          {status === 'requires_payment_method' && (
            <Link
              href={`/${locale}/checkout`}
              className="inline-block mt-2 text-sm font-medium text-rose-600 hover:underline"
            >
              {dict.tryAgain}
            </Link>
          )}

          <Link
            href={`/${locale}`}
            className="inline-block mt-4 text-sm font-medium text-stone-600 hover:underline"
          >
            {dict.backToHome}
          </Link>
        </>
      )}
    </div>
  )
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto py-10 text-center">
        <p className="text-stone-500">A carregar…</p>
      </div>
    }>
      <PaymentResultInner />
    </Suspense>
  )
}