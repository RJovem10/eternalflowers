import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionaries'

export default async function ThankYou({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale)
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">🌸</div>
      <h1 className="text-2xl font-semibold">{dict.thankYouTitle}</h1>
      <p className="text-stone-600 mt-2">{dict.thankYouMessage}</p>
      <Link href={`/${locale}`} className="mt-6 inline-block text-rose-600 hover:underline">
        {dict.backToHome}
      </Link>
    </div>
  )
}