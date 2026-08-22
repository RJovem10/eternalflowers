import { Suspense } from 'react'
import PaymentLinkResult from '@/components/PaymentLinkResult'

export default async function ManualPaymentResultPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <Suspense fallback={<p className="text-center text-sm text-stone-600">A confirmar o pagamento…</p>}>
        <PaymentLinkResult locale={locale} />
      </Suspense>
    </main>
  )
}
