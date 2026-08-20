import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { locales, defaultLocale } from '@/i18n/dictionaries'
import {
  landingSlugs,
  resolveLanding,
  botanicalContent,
  orchidContent,
} from '@/content/landing-pages'

export const dynamic = 'force-static'

// ── Slug whitelist for generateStaticParams ────────────
export async function generateStaticParams() {
  const params: Array<{ locale: string; landing: string }> = []
  for (const locale of locales) {
    for (const type of Object.keys(landingSlugs) as Array<keyof typeof landingSlugs>) {
      params.push({ locale, landing: landingSlugs[type][locale] })
    }
  }
  return params
}

// ── Metadata ──────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; landing: string }>
}): Promise<Metadata> {
  const { locale, landing: slug } = await params
  const landingType = resolveLanding(locale, slug)
  if (!landingType) return {}

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://eternalflowers.pt'

  const content =
    landingType === 'botanical' ? botanicalContent[locale] : orchidContent[locale]
  if (!content) return {}

  // ── hreflang alternatives for this semantic page ────
  const languages: Record<string, string> = {}
  for (const l of locales) {
    const altSlug = landingSlugs[landingType][l]
    languages[l] = `${siteUrl}/${l}/${altSlug}`
  }
  languages['x-default'] = `${siteUrl}/${defaultLocale}/${landingSlugs[landingType][defaultLocale]}`

  return {
    title: content.meta.title,
    description: content.meta.description,
    alternates: {
      canonical: `${siteUrl}/${locale}/${slug}`,
      languages,
    },
    openGraph: {
      title: content.meta.ogTitle,
      description: content.meta.ogDescription,
      url: `${siteUrl}/${locale}/${slug}`,
      siteName: 'Eternal Flowers',
      type: 'website',
      locale: ({ pt: 'pt_PT', en: 'en_GB', es: 'es_ES', it: 'it_IT', de: 'de_DE' } as Record<string, string>)[locale] || 'pt_PT',
    },
    robots: { index: true, follow: true },
  }
}

// ── Landing page component ────────────────────────────
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string; landing: string }>
}) {
  const { locale, landing: slug } = await params
  const landingType = resolveLanding(locale, slug)
  if (!landingType) notFound()

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://eternalflowers.pt'

  const content =
    landingType === 'botanical' ? botanicalContent[locale] : orchidContent[locale]
  if (!content) notFound()

  // Cross-ref: slug for the other landing type in this locale
  const otherType: 'botanical' | 'orchid' = landingType === 'botanical' ? 'orchid' : 'botanical'
  const otherSlug = landingSlugs[otherType][locale]

  const isPt = locale === 'pt'

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* BreadcrumbList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: isPt ? 'Início' : landingType === 'botanical'
                  ? ({ pt: 'Início', en: 'Home', es: 'Inicio', it: 'Home', de: 'Start' } as Record<string, string>)[locale] || 'Home'
                  : ({ pt: 'Início', en: 'Home', es: 'Inicio', it: 'Home', de: 'Start' } as Record<string, string>)[locale] || 'Home',
                item: `${siteUrl}/${locale}`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: content.h1,
                item: `${siteUrl}/${locale}/${slug}`,
              },
            ],
          }),
        }}
      />

      {/* ─── Back link ─── */}
      <div className="max-w-content mx-auto px-6 lg:px-8 pt-24 lg:pt-28">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center text-xs uppercase tracking-[0.18em] text-brand-charcoal/50 transition-colors duration-300 hover:text-brand-gold-dark mb-8"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 mr-1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {({ pt: 'Início', en: 'Home', es: 'Inicio', it: 'Home', de: 'Start' } as Record<string, string>)[locale]}
        </Link>
      </div>

      {/* ─── H1 + Intro ─── */}
      <section className="max-w-content mx-auto px-6 lg:px-8 pb-12 lg:pb-16">
        <h1 className="font-display text-3xl lg:text-[3rem] font-light leading-tight tracking-tight text-brand-charcoal">
          {content.h1}
        </h1>
        <div className="mt-4 w-12 h-[1px] bg-brand-gold/60" />
        <p className="mt-6 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed max-w-prose font-body font-light">
          {content.intro}
        </p>
      </section>

      {/* ─── Content sections ─── */}
      {content.sections.map((section, i) => (
        <section
          key={i}
          className={`py-12 lg:py-16 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cream'}`}
        >
          <div className="max-w-content mx-auto px-6 lg:px-8">
            <div className="max-w-prose">
              <div className="inline-flex items-center gap-2.5 mb-4">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
              </div>
              <h2 className="font-display text-2xl lg:text-3xl font-light leading-tight tracking-tight text-brand-charcoal mb-6">
                {section.heading}
              </h2>
              <div className="space-y-4">
                {section.body.map((p, j) => (
                  <p
                    key={j}
                    className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ─── Cross-link to the other pillar page ─── */}
      <section className="bg-brand-cream py-8 lg:py-10 border-t border-brand-wood/8">
        <div className="max-w-content mx-auto px-6 lg:px-8 text-center">
          <p className="text-sm text-brand-charcoal/50 font-body font-light mb-3">
            {landingType === 'botanical'
              ? ({ pt: 'Também criamos joias com orquídeas naturais.',
                  en: 'We also create jewellery with natural orchids.',
                  es: 'También creamos joyas con orquídeas naturales.',
                  it: 'Creiamo anche gioielli con orchidee naturali.',
                  de: 'Wir fertigen auch Schmuck mit natürlichen Orchideen.' } as Record<string, string>)[locale]
              : ({ pt: 'Descubra também as nossas joias botânicas com flores naturais.',
                  en: 'Also discover our botanical jewellery with natural flowers.',
                  es: 'Descubra también nuestras joyas botánicas con flores naturales.',
                  it: 'Scoprite anche i nostri gioielli botanici con fiori naturali.',
                  de: 'Entdecken Sie auch unseren botanischen Schmuck mit natürlichen Blumen.' } as Record<string, string>)[locale]
            }
          </p>
          <Link
            href={`/${locale}/${otherSlug}`}
            className="inline-flex items-center text-xs uppercase tracking-[0.2em] text-brand-gold hover:text-brand-gold-dark transition-colors duration-300 font-body font-medium"
          >
            {({ pt: 'Saber mais →',
                en: 'Learn more →',
                es: 'Saber más →',
                it: 'Scopri di più →',
                de: 'Mehr erfahren →' } as Record<string, string>)[locale]}
          </Link>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="max-w-prose mx-auto">
            <h2 className="font-display text-2xl lg:text-3xl font-light leading-tight tracking-tight text-brand-charcoal text-center mb-10">
              {({ pt: 'Perguntas Frequentes',
                  en: 'Frequently Asked Questions',
                  es: 'Preguntas Frecuentes',
                  it: 'Domande Frequenti',
                  de: 'Häufig gestellte Fragen' } as Record<string, string>)[locale]}
            </h2>
            <div className="space-y-6">
              {content.faq.map((item, i) => (
                <div key={i}>
                  <h3 className="font-display text-lg font-light text-brand-charcoal mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm lg:text-base text-brand-charcoal/55 leading-relaxed font-body font-light">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="bg-brand-charcoal py-16 lg:py-20">
        <div className="max-w-content mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl lg:text-3xl font-light leading-tight tracking-tight text-white/90">
            {content.ctaHeading}
          </h2>
          <div className="mt-6 mx-auto w-12 h-[1px] bg-brand-gold/40" />
          <div className="mt-8">
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
            >
              {content.ctaText}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Category context links ─── */}
      <section className="bg-brand-cream py-12 lg:py-16">
        <div className="max-w-content mx-auto px-6 lg:px-8 text-center">
          <p className="text-sm text-brand-charcoal/50 font-body font-light">
            {landingType === 'botanical'
              ? ({ pt: 'Explore as nossas joias botânicas por tipo de peça no catálogo.',
                  en: 'Explore our botanical jewellery by type of piece in the catalogue.',
                  es: 'Explore nuestras joyas botánicas por tipo de pieza en el catálogo.',
                  it: 'Esplorate i nostri gioielli botanici per tipo di pezzo nel catalogo.',
                  de: 'Entdecken Sie unseren botanischen Schmuck nach Stücktyp im Katalog.' } as Record<string, string>)[locale]
              : ({ pt: 'Explore o catálogo da Eternal Flowers para ver as peças atualmente disponíveis.',
                  en: 'Explore the Eternal Flowers catalogue to see the pieces currently available.',
                  es: 'Explore el catálogo de Eternal Flowers para ver las piezas actualmente disponibles.',
                  it: 'Esplorate il catalogo di Eternal Flowers per vedere i pezzi attualmente disponibili.',
                  de: 'Erkunden Sie den Katalog von Eternal Flowers, um die aktuell verfügbaren Stücke zu sehen.' } as Record<string, string>)[locale]
            }
          </p>
          <div className="mt-4">
            <Link
              href={`/${locale}/catalog`}
              className="text-xs uppercase tracking-[0.2em] text-brand-charcoal/40 hover:text-brand-gold transition-colors duration-300 font-body font-medium"
            >
              {({ pt: 'Catálogo →',
                  en: 'Catalogue →',
                  es: 'Catálogo →',
                  it: 'Catalogo →',
                  de: 'Katalog →' } as Record<string, string>)[locale]}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}