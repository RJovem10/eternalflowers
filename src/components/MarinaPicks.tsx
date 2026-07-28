import Link from 'next/link'
import Image from 'next/image'
import Section from './Section'
import type { Media } from '@/payload-types'

interface FlowerData {
  id: string
  name: string
  price: number
  image?: (number | null) | Media
}

interface MarinaPicksProps {
  flowers: FlowerData[]
  locale: string
  dict: any
}

export default function MarinaPicks({ flowers, locale, dict }: MarinaPicksProps) {
  if (flowers.length === 0) return null

  return (
    <Section
      title="Escolhas da Marina"
      subtitle="Peças selecionadas especialmente para si"
      align="center"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {flowers.slice(0, 4).map((f) => {
          const img = f.image && typeof f.image !== 'number' ? f.image : null
          return (
            <Link
              key={f.id}
              href={`/${locale}/flower/${f.id}`}
              className="group bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-all"
            >
              <div className="aspect-square relative bg-stone-50">
                {img?.url ? (
                  <Image
                    src={img.url}
                    alt={f.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl opacity-30">💍</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-stone-800 truncate">{f.name}</h3>
                <p className="text-sm text-amber-700 font-semibold mt-1">{f.price.toFixed(2)} €</p>
              </div>
            </Link>
          )
        })}
      </div>
      <div className="mt-8 text-center">
        <Link
          href={`/${locale}/catalog`}
          className="inline-flex items-center text-sm text-stone-500 hover:text-stone-800 transition-colors"
        >
          {dict.viewDetails || 'Ver catálogo completo'} →
        </Link>
      </div>
    </Section>
  )
}