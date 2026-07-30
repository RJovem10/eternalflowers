import Link from 'next/link'

export default async function ThankYou({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">🌸</div>
      <h1 className="text-2xl font-semibold">Obrigado!</h1>
      <p className="text-stone-600 mt-2">Recebemos o teu pedido. A Marina contactará em breve.</p>
      <Link href={`/${locale}`} className="mt-6 inline-block text-rose-600 hover:underline">
        Voltar ao início
      </Link>
    </div>
  )
}
