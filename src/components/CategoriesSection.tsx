import Link from 'next/link'
import Section from './Section'

interface CategoryData {
  id: string
  name: string
  slug: string
  description?: string | null
}

interface CategoriesSectionProps {
  categories: CategoryData[]
  locale: string
}

export default function CategoriesSection({ categories, locale }: CategoriesSectionProps) {
  if (categories.length === 0) return null

  return (
    <Section
      title="Categorias"
      subtitle="Descubra as nossas joias botânicas por tipo de peça"
      align="center"
      background="bg-stone-50"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${locale}/catalog?category=${cat.slug}`}
            className="group bg-white rounded-xl border border-stone-200 p-6 text-center hover:border-stone-300 hover:shadow-sm transition-all"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center text-xl group-hover:bg-amber-50 transition-colors">
              💎
            </div>
            <h3 className="font-medium text-stone-800 group-hover:text-amber-700 transition-colors">
              {cat.name}
            </h3>
            {cat.description && (
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">{cat.description}</p>
            )}
          </Link>
        ))}
      </div>
    </Section>
  )
}