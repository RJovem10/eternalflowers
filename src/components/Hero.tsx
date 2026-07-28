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
}

/**
 * Sanitiza um link vindo do CMS: impede "undefined" ou "null" no URL final.
 * Se o valor for inválido, devolve '/' (home).
 */
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
}: HeroProps) {
  const image = heroImage && typeof heroImage !== 'number' ? heroImage : null
  const hasSecondary =
    secondaryButtonText && secondaryButtonLink && secondaryButtonText.length > 0

  // Fallback image segura — usa <img> nativo em vez de CSS url() para evitar
  // resolução relativa ao path da página (ex: /pt/hero-fallback.png)
  const fallbackImage = '/hero-fallback.png'

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden w-screen -ml-[50vw] left-1/2">
      {/* Background */}
      <div className="absolute inset-0 bg-stone-900">
        {image?.url ? (
          <Image
            src={image.url}
            alt={heroTitle}
            fill
            className="object-cover opacity-70"
            sizes="100vw"
            priority
          />
        ) : (
          <img
            src={fallbackImage}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900/80 via-stone-900/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-4 w-full">
        <div className="max-w-xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-stone-50 leading-tight">
            {heroTitle}
          </h1>

          <p className="mt-6 text-lg md:text-xl text-stone-300 leading-relaxed max-w-prose">
            {heroSubtitle}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              variant="accent"
              href={`/${locale}${safeLink(primaryButtonLink)}`}
            >
              {primaryButtonText}
            </Button>

            {hasSecondary && (
              <Button
                variant="accent"
                href={`/${locale}${safeLink(secondaryButtonLink)}`}
                className="bg-transparent border border-stone-400 text-stone-200 hover:bg-stone-800/50 hover:text-stone-50 hover:border-stone-300"
              >
                {secondaryButtonText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}