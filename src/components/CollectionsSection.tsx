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
}

export default function CollectionsSection({ collections, locale }: CollectionsSectionProps) {
  if (collections.length === 0) return null

  return (
    <Section
      title="Coleções"
      subtitle="Inspiradas em momentos especiais"
      align="center"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((col) => {
          const img = col.image && typeof col.image !== 'number' ? col.image : null
          return (
            <Link
              key={col.id}
              href={`/${locale}/catalog?collection=${col.slug}`}
              className="group block rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 hover:shadow-lg transition-all"
            >
              <div className="aspect-[4/3] relative overflow-hidden">
                {img?.url ? (
                  <Image
                    src={img.url}
                    alt={col.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                    <span className="text-5xl opacity-40">🌿</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-medium text-stone-800 group-hover:text-amber-700 transition-colors">
                  {col.name}
                </h3>
                {col.description && (
                  <p className="text-sm text-stone-500 mt-1 line-clamp-2">{col.description}</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}