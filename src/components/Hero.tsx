import Image from 'next/image'
import Button from './Button'
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
  dict: any
}

function safeLink(link: string | undefined | null): string {
  if (!link || link === 'undefined' || link === 'null') return '/'
  return link.startsWith('/') ? link : `/${link}`
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
  dict,
}: HeroProps) {
  const image = heroImage && typeof heroImage !== 'number' ? heroImage : null
  const hasSecondary =
    secondaryButtonText && secondaryButtonLink && secondaryButtonText.length > 0

  return (
    <section className="relative min-h-screen flex items-end lg:items-center overflow-hidden">
      {/* Full-bleed background — a imagem é a heroína */}
      <div className="absolute inset-0">
        {image?.url ? (
          <Image
            src={image.url}
            alt={heroTitle}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          /* Fallback elegante: gradiente que evoca uma orquídea em macro */
          <div className="w-full h-full bg-gradient-to-br from-brand-charcoal via-brand-charcoal to-[#3D2E2A]" />
        )}
        {/* Overlay subtil — apenas o suficiente para tornar o texto legível */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/70 via-brand-charcoal/30 to-brand-charcoal/10" />
      </div>

      {/* Conteúdo — minimalista, elegante, inspirado em Tiffany */}
      <div className="relative w-full max-w-content mx-auto px-6 lg:px-8 pb-16 lg:pb-24 pt-40 lg:pt-0">
        <div className="max-w-2xl">
          {/* Badge de entrada — "Joias Botânicas Artesanais" */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/70 text-[11px] uppercase tracking-[0.2em] font-body font-medium mb-6 lg:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
            Joias Botânicas Artesanais
          </div>

          {/* Título — grande, leve, dramático */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-light leading-[0.95] tracking-tight text-white max-w-3xl">
            {heroTitle}
          </h1>

          {/* Linha dourada decorativa — um traço que separa o título do mundo */}
          <div className="my-6 lg:my-8 w-12 h-[1.5px] bg-brand-gold/80" />

          {/* Subtítulo — minimal, apenas o essencial */}
          {heroSubtitle && (
            <p className="text-base md:text-lg text-white/60 leading-relaxed max-w-lg font-body font-light">
              {heroSubtitle}
            </p>
          )}

          {/* CTAs — discretos, sem desespero de venda */}
          <div className="mt-8 lg:mt-10 flex flex-wrap gap-4">
            <Button
              variant="primary"
              href={`/${locale}${safeLink(primaryButtonLink)}`}
            >
              {primaryButtonText}
            </Button>

            {hasSecondary && (
              <Button
                variant="ghost"
                href={`/${locale}${safeLink(secondaryButtonLink)}`}
              >
                {secondaryButtonText}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Scroll indicator — sugestão subtil de que há mais conteúdo */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
        <span className="text-[10px] uppercase tracking-[0.3em] font-body font-light">{dict.scroll}</span>
        <div className="w-[1px] h-8 bg-gradient-to-b from-white/40 to-transparent" />
      </div>
    </section>
  )
}