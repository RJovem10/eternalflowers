import Image from 'next/image'
import Link from 'next/link'
import type { Media } from '@/payload-types'

interface HeroProps {
  heroImage?: (number | null) | Media
  heroTitle: string
  heroSubtitle: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText?: string | null
  secondaryButtonLink?: string | null
  locale: string
}

export default function Hero({
  heroImage,
  heroTitle,
  heroSubtitle,
  primaryButtonText,
  primaryButtonLink,
  secondaryButtonText,
  secondaryButtonLink,
  locale,
}: HeroProps) {
  const image = heroImage && typeof heroImage !== 'number' ? heroImage : null
  const hasSecondary =
    secondaryButtonText && secondaryButtonLink && secondaryButtonText.length > 0

  return (
    <section className="py-12 lg:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Imagem */}
        <div className="relative aspect-[4/3] lg:aspect-[5/4] overflow-hidden rounded-2xl bg-stone-100">
          {image?.url ? (
            <Image
              src={image.url}
              alt={heroTitle}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-full text-stone-300 text-sm">
              Sem imagem
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="space-y-6 lg:space-y-8">
          <h1 className="text-3xl lg:text-5xl font-light tracking-tight text-stone-900 leading-tight">
            {heroTitle}
          </h1>

          <p className="text-lg lg:text-xl text-stone-500 leading-relaxed max-w-prose">
            {heroSubtitle}
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href={`/${locale}${primaryButtonLink}`}
              className="inline-flex items-center px-6 py-3 rounded-full bg-stone-900 text-stone-50 text-sm font-medium tracking-wide hover:bg-stone-800 transition-colors"
            >
              {primaryButtonText}
            </Link>

            {hasSecondary && (
              <Link
                href={`/${locale}${secondaryButtonLink}`}
                className="inline-flex items-center px-6 py-3 rounded-full border border-stone-300 text-stone-700 text-sm font-medium tracking-wide hover:border-stone-400 hover:text-stone-900 transition-colors"
              >
                {secondaryButtonText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}