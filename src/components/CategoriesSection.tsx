import Link from 'next/link'
import Image from 'next/image'
import Section from './Section'

interface CategoryData {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: any
  sortOrder?: number | null
  isActive?: boolean | null
}

interface CategoriesSectionProps {
  categories: CategoryData[]
  locale: string
  dict: any
}

function getCategoryImageUrl(image: any): string | null {
  if (!image || typeof image !== 'object') return null
  // Prefer card size
  if (image.sizes?.card?.url) return image.sizes.card.url
  // Fallback to full url
  if (image.url) return image.url
  return null
}

export default function CategoriesSection({ categories, locale, dict }: CategoriesSectionProps) {
  // Filter active, sort by sortOrder, fallback to name
  const activeCategories = categories
    .filter((cat) => cat.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))

  if (activeCategories.length === 0) return null

  return (
    <Section
      title={dict.categoriesTitle}
      subtitle={dict.categoriesSubtitle}
      align="center"
      background="bg-brand-cream"
      size="default"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {activeCategories.map((cat) => {
          const imageUrl = getCategoryImageUrl(cat.image)
          const hasImage = imageUrl !== null

          return (
            <Link
              key={cat.id}
              href={`/${locale}/category/${cat.slug}`}
              className="group relative bg-white text-center transition-all duration-300 border border-brand-wood/8 hover:border-brand-gold/25 hover:bg-white/80 overflow-hidden"
            >
              {/* Image area — 1:1 aspect ratio */}
              <div className="relative aspect-square overflow-hidden">
                {hasImage ? (
                  <Image
                    src={imageUrl!}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-cream to-white" />
                )}
              </div>

              {/* Text area */}
              <div className="px-4 py-5">
                <h3 className="font-display text-base font-light text-brand-charcoal/75 group-hover:text-brand-gold-dark transition-colors duration-300">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs text-brand-charcoal/35 mt-1.5 line-clamp-2 font-body font-light">
                    {cat.description}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}
