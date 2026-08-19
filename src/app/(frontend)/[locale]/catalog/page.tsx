import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import type { Metadata } from 'next'
import FlowerCard from '@/components/FlowerCard'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { payloadLocaleOptions } from '@/lib/payload-locale'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const dict = getDictionary(locale)

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://eternalflowers.pt'

  const languages: Record<string, string> = {}
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/catalog`
  }
  languages['x-default'] = `${siteUrl}/${defaultLocale}/catalog`

  return {
    title: `${dict.catalog} — Eternal Flowers Portugal`,
    description: dict.catalogDescription,
    alternates: {
      canonical: `${siteUrl}/${locale}/catalog`,
      languages,
    },
    robots: { index: true, follow: true },
  }
}

export default async function Catalog({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string; collection?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams

  // ── Legacy query-parameter redirects ──────────────────────
  // Old URLs: /{locale}/catalog?category={slug} or ?collection={slug}
  // Redirect to the new crawlable canonical routes.
  if (sp.category) {
    const payload = await getPayload({ config })
    const catCheck = await payload.find({
      collection: 'categories',
      where: { slug: { equals: sp.category } },
      limit: 1,
      depth: 0,
      ...payloadLocaleOptions(locale as Locale),
    })
    if (catCheck.docs.length > 0) {
      redirect(`/${locale}/category/${sp.category}`)
    }
  }

  if (sp.collection) {
    const payload = await getPayload({ config })
    const colCheck = await payload.find({
      collection: 'collections',
      where: {
        slug: { equals: sp.collection },
        isActive: { equals: true },
      },
      limit: 1,
      depth: 0,
      ...payloadLocaleOptions(locale as Locale),
    })
    if (colCheck.docs.length > 0) {
      redirect(`/${locale}/collection/${sp.collection}`)
    }
  }

  // ── Normal catalog render ─────────────────────────────────
  const dict = getDictionary(locale)
  const payload = await getPayload({ config })

  const flowers = await payload.find({
    collection: 'flowers',
    limit: 200,
    sort: '-createdAt',
    depth: 1,
    where: { isPublic: { equals: true } },
    ...payloadLocaleOptions(locale as Locale),
  })

  const nf = ({ pt: 'namePt', en: 'nameEn', es: 'nameEs', it: 'nameIt', de: 'nameDe' }[locale] || 'namePt')

  const cards = flowers.docs.map((f: any) => ({
    id: f.id,
    name: f[nf] || f.namePt || '—',
    price: f.price,
    image: f.image?.url || null,
    availability: f.availability || 'available',
    locale,
  }))

  return (
    <div>
      <Link
        href={`/${locale}`}
        className="inline-flex items-center text-xs uppercase tracking-[0.18em] text-brand-charcoal/50 transition-colors duration-300 hover:text-brand-gold-dark mb-8"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-3.5 h-3.5 mr-1.5"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {dict.home}
      </Link>
      <h1 className="text-2xl font-semibold mb-6">{dict.catalog}</h1>
      {cards.length === 0 ? (
        <p className="text-stone-500">{dict.emptyCatalog}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <FlowerCard key={c.id} flower={c} dict={dict} />
          ))}
        </div>
      )}
    </div>
  )
}