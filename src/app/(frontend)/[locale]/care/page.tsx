import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  'https://eternalflowers.pt'

const ogLocaleMap: Record<string, string> = {
  pt: 'pt_PT',
  en: 'en_GB',
  es: 'es_ES',
  it: 'it_IT',
  de: 'de_DE',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const dict = getDictionary(locale)

  const languages: Record<string, string> = {}
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/care`
  }
  languages['x-default'] = `${siteUrl}/${defaultLocale}/care`

  return {
    title: dict.careSeoTitle,
    description: dict.careSeoDescription,
    alternates: {
      canonical: `${siteUrl}/${locale}/care`,
      languages,
    },
    openGraph: {
      title: dict.careSeoTitle,
      description: dict.careSeoDescription,
      locale: ogLocaleMap[locale] || 'pt_PT',
      siteName: 'Eternal Flowers',
      type: 'website',
      url: `${siteUrl}/${locale}/care`,
    },
  }
}

// ─── Reusable section wrapper ───────────────────────────
function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={`py-16 lg:py-24 ${className}`} id={id}>
      <div className="max-w-content mx-auto px-6 lg:px-8">{children}</div>
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl lg:text-3xl font-light text-brand-charcoal mb-8 lg:mb-10">
      {children}
    </h2>
  )
}

// ─── FAQ accordion item ─────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-brand-sage-light/40 last:border-b-0">
      <summary className="flex items-center justify-between py-5 px-1 cursor-pointer text-brand-charcoal font-display text-lg font-light list-none [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span className="text-brand-gold/60 group-open:rotate-180 transition-transform duration-300 text-xl leading-none">
          ▾
        </span>
      </summary>
      <div className="px-1 pb-5 text-brand-charcoal/70 font-body font-light text-sm leading-relaxed">
        {answer}
      </div>
    </details>
  )
}

// ─── Care card ──────────────────────────────────────────
function CareCard({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div className="flex gap-5 p-6 lg:p-8 bg-white/60 rounded-sm border border-brand-sage-light/20">
      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-lavender/30 flex items-center justify-center font-display text-sm text-brand-charcoal/60">
        {number}
      </span>
      <div>
        <h3 className="font-display text-lg font-medium text-brand-charcoal mb-2">
          {title}
        </h3>
        <p className="text-brand-charcoal/65 font-body font-light text-sm leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  )
}

export default async function CarePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const dict = getDictionary(locale)
  const isPt = locale === 'pt'

  return (
    <>
      {/* ─── STRUCTURED DATA: FAQ ───────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: dict.careFaq1Q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: dict.careFaq1A,
                },
              },
              {
                '@type': 'Question',
                name: dict.careFaq2Q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: dict.careFaq2A,
                },
              },
              {
                '@type': 'Question',
                name: dict.careFaq3Q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: dict.careFaq3A,
                },
              },
              {
                '@type': 'Question',
                name: dict.careFaq4Q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: dict.careFaq4A,
                },
              },
            ],
          }),
        }}
      />

      {/* ─── HERO ─────────────────────────────────────── */}
      <section className="bg-brand-cream pt-12 pb-8 lg:pt-20 lg:pb-12">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/60 font-body font-medium mb-4">
            {dict.careEyebrow}
          </p>
          <h1 className="font-display text-3xl lg:text-[2.8rem] font-light leading-tight tracking-tight text-brand-charcoal max-w-2xl">
            {dict.careTitle}
          </h1>
          <p className="mt-5 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light max-w-xl">
            {dict.careIntro}
          </p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-body font-medium">
            Eternal Flowers · Resin Art &amp; Jewelry by Mar&Natur&reg;
          </p>
        </div>
      </section>

      {/* ─── GUIA VISUAL / POSTER ─────────────────────── */}
      {/* Only show the poster for PT; other locales show the translated HTML content only.
          The poster image files for future locale editions are prepared at:
            public/images/guides/eternal-flowers-care-guide-en.png
            public/images/guides/eternal-flowers-care-guide-es.png
            public/images/guides/eternal-flowers-care-guide-it.png
            public/images/guides/eternal-flowers-care-guide-de.png
      */}
      {isPt && (
        <Section className="bg-white">
          <SectionTitle>{dict.careVisualGuideTitle}</SectionTitle>
          <div className="max-w-3xl mx-auto">
            <div className="relative overflow-hidden rounded-sm border border-brand-sage-light/20 bg-brand-cream/30">
              <Image
                src="/images/guides/eternal-flowers-care-guide-pt.png"
                alt={dict.careVisualGuideTitle}
                width={1200}
                height={1697}
                className="w-full h-auto"
                priority
              />
            </div>

            {/* Save / Open buttons */}
            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <a
                href="/images/guides/eternal-flowers-care-guide-pt.png"
                download="guia-cuidados-eternal-flowers.png"
                className="inline-flex items-center px-6 py-3 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
              >
                {dict.careSaveButton}
              </a>
              <a
                href="/images/guides/eternal-flowers-care-guide-pt.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-transparent border border-brand-gold/40 text-brand-gold text-sm font-medium tracking-wider uppercase hover:bg-brand-gold/10 hover:border-brand-gold transition-all duration-300 font-body"
              >
                {dict.careOpenButton}
              </a>
            </div>
          </div>
        </Section>
      )}

      {/* ─── 5 CUIDADOS ESSENCIAIS ────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-3xl mx-auto">
          <SectionTitle>{dict.careVisualGuideTitle}</SectionTitle>
          <div className="space-y-4">
            <CareCard number="1" title={dict.care1Title} text={dict.care1} />
            <CareCard number="2" title={dict.care2Title} text={dict.care2} />
            <CareCard number="3" title={dict.care3Title} text={dict.care3} />
            <CareCard number="4" title={dict.care4Title} text={dict.care4} />
            <CareCard number="5" title={dict.care5Title} text={dict.care5} />
          </div>
        </div>
      </Section>

      {/* ─── LIMPEZA ──────────────────────────────────── */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <SectionTitle>{dict.careCleaningTitle}</SectionTitle>
          <p className="text-brand-charcoal/65 font-body font-light text-base lg:text-lg leading-relaxed max-w-lg mx-auto">
            {dict.careCleaning}
          </p>
        </div>
      </Section>

      {/* ─── SE A PEÇA SE MOLHAR ─────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-lavender/20 flex items-center justify-center text-2xl">
            💧
          </div>
          <SectionTitle>{dict.careWetTitle}</SectionTitle>
          <p className="text-brand-charcoal/65 font-body font-light text-base lg:text-lg leading-relaxed max-w-lg mx-auto">
            {dict.careWet}
          </p>
        </div>
      </Section>

      {/* ─── GARANTIA ─────────────────────────────────── */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <SectionTitle>{dict.careWarrantyTitle}</SectionTitle>
          <p className="text-brand-charcoal/65 font-body font-light text-base lg:text-lg leading-relaxed max-w-lg mx-auto mb-8">
            {dict.careWarranty}
          </p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '351000000000'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
          >
            {dict.careContact}
          </a>
          <p className="mt-6 text-xs text-brand-charcoal/35 font-body font-light max-w-md mx-auto">
            {dict.careLegal}
          </p>
        </div>
      </Section>

      {/* ─── FAQ ──────────────────────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-2xl mx-auto">
          <SectionTitle>{dict.careFaqTitle}</SectionTitle>
          <div className="bg-white rounded-sm px-4 lg:px-8">
            <FaqItem question={dict.careFaq1Q} answer={dict.careFaq1A} />
            <FaqItem question={dict.careFaq2Q} answer={dict.careFaq2A} />
            <FaqItem question={dict.careFaq3Q} answer={dict.careFaq3A} />
            <FaqItem question={dict.careFaq4Q} answer={dict.careFaq4A} />
          </div>
        </div>
      </Section>

      {/* ─── CTA FINAL ────────────────────────────────── */}
      <section className="py-24 lg:py-32 bg-brand-charcoal text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 50%, #D4A853 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        <div className="relative max-w-2xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/50 font-body font-medium mb-5">
            {dict.ctaLabel}
          </p>
          <h2 className="font-display text-3xl lg:text-[3rem] font-light leading-tight tracking-tight">
            {dict.careFinalCta}
          </h2>
          <div className="mt-10 lg:mt-12">
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
            >
              {dict.careCollectionCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}