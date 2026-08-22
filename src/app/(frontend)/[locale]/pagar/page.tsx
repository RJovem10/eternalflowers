import type { Metadata } from 'next'
import PaymentLinkSection from '@/components/PaymentLinkSection'

export const metadata: Metadata = {
  title: 'Pagamento seguro — Eternal Flowers',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function ManualPaymentPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-stone-900">Pagamento seguro</h1>
        <p className="mt-2 text-sm text-stone-600">
          Confirme os dados de pagamento apresentados pelo Stripe para concluir a encomenda.
        </p>
      </div>
      <PaymentLinkSection locale={locale} />
    </main>
  )
}
