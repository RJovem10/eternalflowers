import Link from 'next/link'
import Image from 'next/image'
import Section from './Section'
import type { Media } from '@/payload-types'

interface CollectionData {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: (number | null) | Media
}

interface CollectionsSectionProps {
  collections: CollectionData[]
  locale: string
  dict: any
}

export default function CollectionsSection({ collections, locale, dict }: CollectionsSectionProps) {
  if (collections.length === 0) return null

  return (
    <Section
      title={dict.collectionsTitle}
      subtitle={dict.collectionsSubtitle}
      align="center"
      size="default"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-brand-wood/8">
        {collections.map((col) => {
          const img = col.image && typeof col.image !== 'number' ? col.image : null
          return (
            <Link
              key={col.id}
              href={`/${locale}/catalog?collection=${col.slug}`}
              className="group relative bg-white overflow-hidden"
            >
              <div className="aspect-[4/3] relative overflow-hidden">
                {img?.url ? (
                  <Image
                    src={img.url}
                    alt={col.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-cream to-white">
                    <Image
                      src="/instagram/3907793258139193626.jpg"
                      alt={col.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                )}
                {/* Overlay subtil no hover — como se a peça ganhasse profundidade */}
                <div className="absolute inset-0 bg-brand-charcoal/0 group-hover:bg-brand-charcoal/5 transition-all duration-500" />
              </div>
              <div className="p-6 lg:p-8">
                <h3 className="font-display text-lg font-light text-brand-charcoal group-hover:text-brand-gold-dark transition-colors duration-300">
                  {col.name}
                </h3>
                {col.description && (
                  <p className="text-sm text-brand-charcoal/45 mt-2 line-clamp-2 font-body font-light leading-relaxed">
                    {col.description}
                  </p>
                )}
                <span className="inline-block mt-4 text-[10px] uppercase tracking-[0.25em] text-brand-gold/70 font-body font-medium group-hover:text-brand-gold transition-colors duration-300">
                  {dict.collectionsCta}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}