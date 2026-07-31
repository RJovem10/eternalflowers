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
      title={dict.marinaPicksTitle}
      subtitle={dict.marinaPicksSubtitle}
      align="center"
      background="bg-white"
      size="default"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-brand-wood/8">
        {flowers.slice(0, 4).map((f) => {
          const img = f.image && typeof f.image !== 'number' ? f.image : null
          return (
            <Link
              key={f.id}
              href={`/${locale}/flower/${f.id}`}
              className="group relative bg-white overflow-hidden"
            >
              <div className="aspect-square relative bg-brand-cream overflow-hidden">
                {img?.url ? (
                  <Image
                    src={img.url}
                    alt={f.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image
                      src="/instagram/3864816945292134886.jpg"
                      alt={f.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                )}
                {/* Hover reveal — um toque dourado a aparecer */}
                <div className="absolute inset-0 border-[1px] border-brand-gold/0 group-hover:border-brand-gold/20 transition-all duration-500 pointer-events-none" />
              </div>
              <div className="p-5">
                <h3 className="font-display text-sm font-light text-brand-charcoal/80 truncate tracking-wide">
                  {f.name}
                </h3>
                <p className="font-body text-sm text-brand-gold-dark font-medium mt-1.5 tracking-wide">
                  {f.price.toFixed(2)} €
                </p>
              </div>
            </Link>
          )
        })}
      </div>
      <div className="mt-10 lg:mt-12 text-center">
        <Link
          href={`/${locale}/catalog`}
          className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 hover:text-brand-gold transition-colors duration-300 font-body font-medium"
        >
          <span className="w-6 h-[1px] bg-brand-charcoal/20 group-hover:bg-brand-gold/50 transition-colors duration-300" />
          {dict.viewDetails || 'Ver catálogo completo'}
          <span className="text-brand-gold/50 group-hover:text-brand-gold transition-colors duration-300">→</span>
        </Link>
      </div>
    </Section>
  )
}