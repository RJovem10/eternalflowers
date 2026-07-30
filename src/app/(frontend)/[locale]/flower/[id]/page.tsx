import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary } from '@/i18n/dictionaries'
import { getPayload } from 'payload'
import config from '@/payload.config'
import ProductGallery from '@/components/ProductGallery'
import ProductInfo from '@/components/ProductInfo'
import ProductStory from '@/components/ProductStory'
import ProductAttributes from '@/components/ProductAttributes'
import RelatedProducts from '@/components/RelatedProducts'
import type { Flower, Category, Collection, Media } from '@/payload-types'

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

  try {
    const payload = await getPayload({ config })
    const flower = await payload.findByID({
      collection: 'flowers',
      id,
      depth: 1,
    })
    const localizedName = getLocaleField<string>(flower, 'name', locale, '')
    const title = flower.creationName || localizedName || flower.scientificName
    const localizedDescription = getLocaleField<string>(flower, 'description', locale, '')
    const price = `${flower.price.toFixed(2)} €`
    const productDescription = localizedDescription || flower.scientificName
    const description = `${productDescription} — ${price}`
    const imageUrl =
      flower.image && typeof flower.image !== 'number'
        ? flower.image.url
        : null

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: imageUrl ? [{ url: imageUrl, alt: title }] : undefined,
      },
    }
  } catch {
    return {}
  }
}

export default async function FlowerDetail({ params }: FlowerPageParams) {
  const { locale, id } = await params
  const dict = getDictionary(locale)
  const payload = await getPayload({ config })

  let flower: Flower
  try {
    flower = await payload.findByID({
      collection: 'flowers',
      id,
      depth: 2,
    })
  } catch {
    notFound()
  }
  if (!flower) notFound()

  const name: string = getLocaleField(flower, 'name', locale, '—')
  const description: string = getLocaleField(flower, 'description', locale, '')

  const image: Media | null = flower.image && typeof flower.image !== 'number' ? flower.image : null
  const images = flower.images?.filter((gi): gi is { image: Media; id?: string | null } =>
    typeof gi.image !== 'number'
  ) ?? null

  const category: (Category | null) = flower.category && typeof flower.category !== 'number'
    ? flower.category as Category
    : null

  const collections: Collection[] = (flower.collections?.filter((c): c is Collection =>
    typeof c !== 'number'
  ) as Collection[]) ?? []

  // Related products from the same category
  let related: Flower[] = []
  if (category) {
    try {
      const relatedRes = await payload.find({
        collection: 'flowers',
        depth: 1,
        where: {
          category: { equals: category.id },
          id: { not_equals: Number(id) },
        },
        limit: 8,
      })
      related = relatedRes.docs
    } catch {
      // silently ignore
    }
  }

  return (
    <article className="mx-auto max-w-content px-6 pb-24 lg:px-8 lg:pb-30">
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
        />
      </div>

      {flower.story?.trim() && (
        <div className="mt-24 lg:mt-32">
          <ProductStory story={flower.story} />
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
