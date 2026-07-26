import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionaries'

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale)
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-bold tracking-tight">🌸 {dict.brand}</h1>
      <p className="text-stone-600 mt-3 text-lg">{dict.tagline}</p>
      <Link
        href={`/${locale}/catalog`}
        className="mt-8 inline-block bg-rose-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-rose-700"
      >
        {dict.catalog}
      </Link>
    </div>
  )
}
