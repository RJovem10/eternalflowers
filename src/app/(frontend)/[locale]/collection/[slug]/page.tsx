import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import { payloadLocaleOptions, payloadLocaleWithoutFallback } from '@/lib/payload-locale'
import FlowerCard from '@/components/FlowerCard'
import Image from 'next/image'
import type { Media } from '@/payload-types'

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

const collectionFallbackDescriptions: Record<string, (name: string) => string> = {
  pt: (name) => `Coleção ${name} — joias botânicas artesanais com flores naturais verdadeiras, preservadas em resina. Peças únicas feitas à mão em Portugal.`,
  en: (name) => `${name} collection — handmade botanical jewellery with real natural flowers preserved in resin. One-of-a-kind pieces handcrafted in Portugal.`,
  es: (name) => `Colección ${name} — joyería botánica artesanal con flores naturales reales preservadas en resina. Piezas únicas hechas a mano en Portugal.`,
  it: (name) => `Collezione ${name} — gioielli botanici artigianali con fiori naturali veri preservati in resina. Pezzi unici fatti a mano in Portogallo.`,
  de: (name) => `${name} Kollektion — handgefertigter botanischer Schmuck mit echten Naturblumen, konserviert in Harz. Einzigartige Stücke, handgefertigt in Portugal.`,
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
    const colResult = await payload.find({
      collection: 'collections',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...payloadLocaleOptions(locale as Locale),
    })

    const collection = colResult.docs[0]
    if (!collection || !collection.isActive) return {}

    // Check if a genuine localized description exists (without PT fallback)
    const colRaw = await payload.find({
      collection: 'collections',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...payloadLocaleWithoutFallback(locale as Locale),
    })
    const localizedDesc = colRaw.docs[0]?.description || null

    const title = `${collection.name} — Eternal Flowers Portugal`
    const fallbackFn = collectionFallbackDescriptions[locale]
    const description =
      localizedDesc ||
      fallbackFn(collection.name)

    const languages: Record<string, string> = {}
    for (const l of locales) {
      languages[l] = `${siteUrl}/${l}/collection/${slug}`
    }
    languages['x-default'] = `${siteUrl}/${defaultLocale}/collection/${slug}`

    return {
      title,
      description,
      alternates: {
        canonical: `${siteUrl}/${locale}/collection/${slug}`,
        languages,
      },
      openGraph: {
        title: `${collection.name} — Eternal Flowers Portugal`,
        description,
        url: `${siteUrl}/${locale}/collection/${slug}`,
      },
      robots: { index: true, follow: true },
    }
  } catch {
    return {}
  }
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const dict = getDictionary(locale)
  const payload = await getPayload({ config })

  // Look up collection by slug
  const colResult = await payload.find({
    collection: 'collections',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    ...payloadLocaleOptions(locale as Locale),
  })

  const collection = colResult.docs[0]
  if (!collection || !collection.isActive) notFound()

  // Load flowers in this collection
  const flowers = await payload.find({
    collection: 'flowers',
    where: { collections: { in: collection.id } },
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

  const img = collection.image && typeof collection.image !== 'number'
    ? (collection.image as Media)
    : null

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
        <span className="text-brand-charcoal/70">{collection.name}</span>
      </nav>

      {/* Collection hero header */}
      <div className="mb-10">
        {img?.url && (
          <div className="relative aspect-[4/3] md:aspect-[3/1] overflow-hidden mb-8">
            <Image
              src={img.url}
              alt={collection.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
        )}
        <h1 className="text-2xl font-semibold">{collection.name}</h1>
        {collection.description && (
          <p className="mt-3 text-sm text-brand-charcoal/60 max-w-prose leading-relaxed">
            {collection.description}
          </p>
        )}
      </div>

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
                name: collection.name,
              },
            ],
          }),
        }}
      />
    </div>
  )
}