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
  const bgImage = '/docs/references/instagram-profile.png'

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
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
          <div
            className="w-full h-full bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${bgImage})` }}
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
              variant="primary"
              href={`/${locale}${primaryButtonLink}`}
            >
              {primaryButtonText}
            </Button>

            {hasSecondary && (
              <Button
                variant="secondary"
                href={`/${locale}${secondaryButtonLink}`}
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