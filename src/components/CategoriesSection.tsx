import Link from 'next/link'
import Section from './Section'

interface CategoryData {
  id: string
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  sortOrder?: number | null
  isActive?: boolean | null
}

interface CategoriesSectionProps {
  categories: CategoryData[]
  locale: string
  dict: any
}

const fallbackIcons: Record<string, string> = {
  brincos: '💎',
  anéis: '💍',
  pingentes: '🌙',
  colares: '📿',
  pulseiras: '🔗',
  conjuntos: '✨',
  decoracao: '🏺',
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
        {activeCategories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${locale}/category/${cat.slug}`}
            className="group relative bg-white px-5 py-8 text-center transition-all duration-300 border border-brand-wood/8 hover:border-brand-gold/25 hover:bg-white/80"
          >
            <div className="text-2xl mb-3 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-400">
              {cat.icon || fallbackIcons[cat.slug] || '🌿'}
            </div>
            <h3 className="font-display text-base font-light text-brand-charcoal/75 group-hover:text-brand-gold-dark transition-colors duration-300">
              {cat.name}
            </h3>
            {cat.description && (
              <p className="text-xs text-brand-charcoal/35 mt-1.5 line-clamp-2 font-body font-light">
                {cat.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </Section>
  )
}