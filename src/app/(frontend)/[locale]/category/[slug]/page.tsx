import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import { payloadLocaleOptions, payloadLocaleWithoutFallback } from '@/lib/payload-locale'
import FlowerCard from '@/components/FlowerCard'

export const dynamic = 'force-dynamic'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  'https://eternalflowers.pt'

const nfMap: Record<string, string> = {
  pt: 'namePt',
  en: 'nameEn',
  es: 'nameEs',
  it: 'nameIt',
  de: 'nameDe',
}

const categoryFallbackDescriptions: Record<string, (name: string) => string> = {
  pt: (name) => `${name} — joias botânicas artesanais com flores naturais verdadeiras, preservadas em resina. Feitas à mão em Portugal.`,
  en: (name) => `${name} — handmade botanical jewellery with real natural flowers preserved in resin. Handcrafted in Portugal.`,
  es: (name) => `${name} — joyería botánica artesanal con flores naturales reales preservadas en resina. Hechas a mano en Portugal.`,
  it: (name) => `${name} — gioielli botanici artigianali con fiori naturali veri preservati in resina. Fatti a mano in Portogallo.`,
  de: (name) => `${name} — handgefertigter botanischer Schmuck mit echten Naturblumen, konserviert in Harz. Handgefertigt in Portugal.`,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const dict = getDictionary(locale)

  try {
    const payload = await getPayload({ config })
    const catResult = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...payloadLocaleOptions(locale as Locale),
    })

    const cat = catResult.docs[0]
    if (!cat) return {}

    // Check if a genuine localized description exists (without PT fallback)
    const catRaw = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...payloadLocaleWithoutFallback(locale as Locale),
    })
    const localizedDesc = catRaw.docs[0]?.description || null

    const title = `${cat.name} — Eternal Flowers Portugal`
    const fallbackFn = categoryFallbackDescriptions[locale]
    const description =
      localizedDesc ||
      fallbackFn(cat.name)

    const languages: Record<string, string> = {}
    for (const l of locales) {
      languages[l] = `${siteUrl}/${l}/category/${slug}`
    }
    languages['x-default'] = `${siteUrl}/${defaultLocale}/category/${slug}`

    return {
      title,
      description,
      alternates: {
        canonical: `${siteUrl}/${locale}/category/${slug}`,
        languages,
      },
      openGraph: {
        title: `${cat.name} — Eternal Flowers Portugal`,
        description,
        url: `${siteUrl}/${locale}/category/${slug}`,
      },
      robots: { index: true, follow: true },
    }
  } catch {
    return {}
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const dict = getDictionary(locale)
  const payload = await getPayload({ config })

  // Look up category by slug
  const catResult = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    ...payloadLocaleOptions(locale as Locale),
  })

  const category = catResult.docs[0]
  if (!category) notFound()

  // Load flowers belonging to this category
  const flowers = await payload.find({
    collection: 'flowers',
    where: { category: { equals: category.id } },
    limit: 200,
    sort: '-createdAt',
    depth: 1,
    ...payloadLocaleOptions(locale as Locale),
  })

  const nf = nfMap[locale] || 'namePt'

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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-brand-charcoal/50 mb-8">
        <Link
          href={`/${locale}`}
          className="transition-colors duration-300 hover:text-brand-gold-dark"
        >
          {dict.home}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/${locale}/catalog`}
          className="transition-colors duration-300 hover:text-brand-gold-dark"
        >
          {dict.catalog}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-brand-charcoal/70">{category.name}</span>
      </nav>

      <h1 className="text-2xl font-semibold mb-6">{category.name}</h1>

      {category.description && (
        <p className="text-sm text-brand-charcoal/60 mb-8 max-w-prose leading-relaxed">
          {category.description}
        </p>
      )}

      {cards.length === 0 ? (
        <p className="text-stone-500">{dict.emptyCatalog}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((c: any) => (
            <FlowerCard key={c.id} flower={c} dict={dict} />
          ))}
        </div>
      )}

      {/* BreadcrumbList structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: dict.home,
                item: `${siteUrl}/${locale}`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: dict.catalog,
                item: `${siteUrl}/${locale}/catalog`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: category.name,
              },
            ],
          }),
        }}
      />
    </div>
  )
}