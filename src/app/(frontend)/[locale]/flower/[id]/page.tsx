import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { payloadLocaleOptions } from '@/lib/payload-locale'
import ProductGallery from '@/components/ProductGallery'
import ProductInfo from '@/components/ProductInfo'
import ProductStory from '@/components/ProductStory'
import ProductAttributes from '@/components/ProductAttributes'
import RelatedProducts from '@/components/RelatedProducts'
import type { Flower, Category, Collection, Media } from '@/payload-types'
import { computePurchaseEligibility } from '@/lib/can-purchase'

export const dynamic = 'force-dynamic'

type FlowerPageParams = {
  params: Promise<{ locale: string; id: string }>
}

function getLocaleField<T>(record: any, field: string, locale: string, fallback: string): T {
  const suffix = ({ pt: 'Pt', en: 'En', es: 'Es', it: 'It', de: 'De' } as Record<string, string>)[locale] || 'Pt'
  return record[`${field}${suffix}`] ?? record[`${field}Pt`] ?? fallback
}

export async function generateMetadata({ params }: FlowerPageParams): Promise<Metadata> {
  const { locale, id } = await params

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://eternalflowers.pt'

  try {
    const payload = await getPayload({ config })
    const flower = await payload.findByID({
      collection: 'flowers',
      id,
      depth: 1,
      ...payloadLocaleOptions(locale as Locale),
    })

    // Do not expose metadata for private products
    if (flower.isPublic !== true) {
      return {}
    }

    const localizedName = getLocaleField<string>(flower, 'name', locale, '')
    const creationName = flower.creationName
    const scientificName = flower.scientificName
    const title = `${creationName || localizedName || scientificName} — Eternal Flowers`
    const localizedDescription = getLocaleField<string>(flower, 'description', locale, '')
    const price = `${flower.price.toFixed(2)} €`
    const hasScientificName = scientificName && scientificName !== title
    // Build a descriptive SEO description mentioning botanical jewellery with real flowers
    const botanicalContext = localizedDescription || scientificName || ''
    const description = botanicalContext
      ? `${botanicalContext} — ${price}`
      : `Joia botânica artesanal com flor natural${scientificName ? ' — ' + scientificName : ''} — ${price}`
    const imageUrl =
      flower.image && typeof flower.image !== 'number'
        ? flower.image.url
        : null

    return {
      title,
      description,
      alternates: {
        canonical: `${siteUrl}/${locale}/flower/${id}`,
        languages: Object.fromEntries(
          locales.map((l) => [l, `${siteUrl}/${l}/flower/${id}`])
        ),
      },
      openGraph: {
        title,
        description,
        type: 'website',
        images: imageUrl ? [{ url: imageUrl, alt: title }] : undefined,
        locale: ({ pt: 'pt_PT', en: 'en_GB', es: 'es_ES', it: 'it_IT', de: 'de_DE' } as Record<string, string>)[locale] || 'pt_PT',
      },
    }
  } catch {
    return {}
  }
}

export default async function FlowerDetail({ params }: FlowerPageParams) {
  const { locale, id } = await params
  const dict = getDictionary(locale)
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://eternalflowers.pt'
  const payload = await getPayload({ config })

  let flower: Flower
  try {
    flower = await payload.findByID({
      collection: 'flowers',
      id,
      depth: 2,
      ...payloadLocaleOptions(locale as Locale),
    })
  } catch (err: any) {
    // Distinguir 404 legítimo (NotFound com status 404) de erros internos
    if (err?.name === 'NotFound' && err?.status === 404) {
      notFound()
    }
    // Erro interno (BD, auth, rede, etc.) — relançar para gerar 500
    throw err
  }
  if (!flower) notFound()

  // Private products must not have a public product page
  if (flower.isPublic !== true) {
    notFound()
  }

  const name: string = getLocaleField(flower, 'name', locale, '—')
  const description: string = getLocaleField(flower, 'description', locale, '')

  const image: Media | null = flower.image && typeof flower.image !== 'number' ? flower.image : null
  const images = flower.images?.filter((gi): gi is { image: Media; id?: string | null } =>
    typeof gi.image !== 'number'
  ) ?? null

  const category: (Category | null) = flower.category && typeof flower.category !== 'number'
    ? flower.category as Category
    : null

  const productUrl = `${siteUrl}/${locale}/flower/${id}`
  const catalogUrl = `${siteUrl}/${locale}/catalog`
  const rawImageUrl = image?.url || null
  // Resolve relative image URL to absolute for structured data
  const absoluteImageUrl = rawImageUrl
    ? rawImageUrl.startsWith('http')
      ? rawImageUrl
      : rawImageUrl.startsWith('/')
        ? `${siteUrl}${rawImageUrl}`
        : `${siteUrl}/${rawImageUrl}`
    : null

  const { schemaAvailability } = computePurchaseEligibility({
    availability: flower.availability || 'available',
    productionMode: flower.productionMode,
    stockQuantity: flower.stockQuantity,
  })

  const collections: Collection[] = (flower.collections?.filter((c): c is Collection =>
    typeof c !== 'number'
  ) as Collection[]) ?? []

  // Related products from the same category (only public)
  let related: Flower[] = []
  if (category) {
    try {
      const relatedRes = await payload.find({
        collection: 'flowers',
        depth: 1,
        where: {
          category: { equals: category.id },
          id: { not_equals: Number(id) },
          isPublic: { equals: true },
        },
        limit: 8,
        ...payloadLocaleOptions(locale as Locale),
      })
      related = relatedRes.docs
    } catch {
      // silently ignore
    }
  }

  return (
    <article className="mx-auto max-w-content px-6 pb-24 lg:px-8 lg:pb-30">
      {/* ─── STRUCTURED DATA ───────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: name,
            description: description || `${name} — joia botânica artesanal com flor natural${flower.scientificName ? ' (' + flower.scientificName + ')' : ''}.`,
            image: absoluteImageUrl ? [absoluteImageUrl] : undefined,
            url: productUrl,
            brand: {
              '@type': 'Brand',
              name: 'Eternal Flowers',
            },
            offers: {
              '@type': 'Offer',
              price: flower.price,
              priceCurrency: 'EUR',
              availability: schemaAvailability,
              url: productUrl,
              seller: {
                '@type': 'Organization',
                name: 'Eternal Flowers',
              },
            },
          }),
        }}
      />
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
                item: catalogUrl,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: name,
              },
            ],
          }),
        }}
      />

      <Link
        href={`/${locale}/catalog`}
        className="inline-flex items-center text-xs uppercase tracking-[0.18em] text-brand-charcoal/50 transition-colors duration-300 hover:text-brand-gold-dark"
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
        {dict.backToCatalog}
      </Link>

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
        <ProductGallery
          singleImage={flower.image as Media | number | null}
          galleryImages={images as { image: Media; id?: string | null }[] | null}
          name={name}
          scientificName={flower.scientificName}
        />
        <ProductInfo
          creationName={flower.creationName}
          scientificName={flower.scientificName}
          category={category}
          collections={collections}
          productType={flower.productType}
          price={flower.price}
          availability={flower.availability || 'available'}
          description={description}
          dict={dict}
          locale={locale}
          flowerId={id}
          flowerName={name}
          flowerImage={image?.url ?? null}
          productionMode={flower.productionMode ?? null}
          stockQuantity={flower.stockQuantity ?? null}
          productionLeadTime={flower.productionLeadTime ?? null}
        />
      </div>

      {flower.story?.trim() && (
        <div className="mt-24 lg:mt-32">
          <ProductStory story={flower.story} dict={dict} />
        </div>
      )}

      <div className="my-20 border-t border-brand-wood/15 lg:my-28" />

      <ProductAttributes dict={dict} />

      {related.length > 0 && (
        <>
          <div className="my-20 border-t border-brand-wood/15 lg:my-28" />
          <RelatedProducts
            products={related.map((r) => ({
              id: r.id,
              name: getLocaleField(r, 'name', locale, '—'),
              price: r.price,
              image: r.image && typeof r.image !== 'number'
                ? (r.image as Media).url
                : null,
              availability: r.availability || 'available',
              locale,
              creationName: r.creationName,
              scientificName: r.scientificName,
            }))}
            dict={dict}
            locale={locale}
          />
        </>
      )}
    </article>
  )
}
