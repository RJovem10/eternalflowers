'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getStripe } from '@/lib/stripe-client'
import { MANUAL_PAYMENT_SESSION_TOKEN_KEY } from './PaymentLinkSection'

type ResultState = 'loading' | 'succeeded' | 'processing' | 'retry' | 'error'

export default function PaymentLinkResult({ locale }: { locale: string }) {
  const searchParams = useSearchParams()
  const processed = useRef(false)
  const [state, setState] = useState<ResultState>('loading')

  useEffect(() => {
    if (processed.current) return
    processed.current = true
    const clientSecret = searchParams.get('payment_intent_client_secret')
    if (!clientSecret) {
      setState('error')
      return
    }

    void Promise.resolve(getStripe())
      .then((stripe) => {
        if (!stripe) throw new Error('Stripe indisponível')
        return stripe.retrievePaymentIntent(clientSecret)
      })
      .then(({ paymentIntent }) => {
        if (!paymentIntent) {
          setState('error')
        } else if (paymentIntent.status === 'succeeded') {
          window.sessionStorage.removeItem(MANUAL_PAYMENT_SESSION_TOKEN_KEY)
          setState('succeeded')
        } else if (paymentIntent.status === 'processing') {
          setState('processing')
        } else if (
          paymentIntent.status === 'requires_payment_method' ||
          paymentIntent.status === 'requires_action'
        ) {
          setState('retry')
        } else {
          setState('error')
        }
      })
      .catch(() => setState('error'))
  }, [searchParams])

  const content: Record<ResultState, { icon: string; title: string; body: string }> = {
    loading: {
      icon: '⏳',
      title: 'A confirmar o pagamento…',
      body: 'Aguarde um momento.',
    },
    succeeded: {
      icon: '✅',
      title: 'Pagamento recebido',
      body: 'Obrigado. A encomenda será confirmada pelo nosso sistema assim que o Stripe comunicar o pagamento.',
    },
    processing: {
      icon: '⏳',
      title: 'Pagamento em processamento',
      body: 'O Stripe ainda está a processar o pagamento. Não volte a pagar.',
    },
    retry: {
      icon: '⚠️',
      title: 'Pagamento não concluído',
      body: 'Pode voltar ao pagamento e tentar novamente.',
    },
    error: {
      icon: '❌',
      title: 'Não foi possível confirmar o resultado',
      body: 'Se o valor tiver sido debitado, não repita o pagamento e contacte a Eternal Flowers.',
    },
  }
  const current = content[state]

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
      <div className="text-4xl" aria-hidden="true">{current.icon}</div>
      <h1 className="text-xl font-semibold text-emerald-800">{current.title}</h1>
      <p className="text-sm text-stone-600">{current.body}</p>
      {state === 'retry' && (
        <Link className="inline-block text-sm font-medium text-rose-600 hover:underline" href={`/${locale}/pagar`}>
          Tentar novamente
        </Link>
      )}
      <div>
        <Link className="inline-block text-sm font-medium text-stone-600 hover:underline" href={`/${locale}`}>
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
