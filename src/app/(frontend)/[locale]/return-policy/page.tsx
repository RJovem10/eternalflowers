import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import type { Metadata } from 'next'
import { getPayloadClient } from '@/payload'
import { returnPolicyContent } from '@/content/return-policy'
import Footer from '@/components/Footer'
import { payloadLocaleOptions } from '@/lib/payload-locale'

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
    languages[l] = `${siteUrl}/${l}/return-policy`
  }
  languages['x-default'] = `${siteUrl}/return-policy`

  const isPt = locale === 'pt'

  return {
    title: dict.returnPolicySeoTitle,
    description: dict.returnPolicySeoDescription,
    alternates: {
      canonical: isPt ? `${siteUrl}/return-policy` : `${siteUrl}/${locale}/return-policy`,
      languages,
    },
    openGraph: {
      title: dict.returnPolicySeoTitle,
      description: dict.returnPolicySeoDescription,
      locale: ogLocaleMap[locale] || 'pt_PT',
      siteName: 'Eternal Flowers',
      type: 'website',
      url: isPt ? `${siteUrl}/return-policy` : `${siteUrl}/${locale}/return-policy`,
    },
  }
}

function Section({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`py-16 lg:py-24 ${className}`}>
      <div className="max-w-content mx-auto px-6 lg:px-8">{children}</div>
    </section>
  )
}

export default async function ReturnPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const dict = getDictionary(locale)
  const content = returnPolicyContent[locale as Locale] || returnPolicyContent[defaultLocale]

  const payload = await getPayloadClient()
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })

  const contactsEmail = siteSettings?.contacts?.email || null
  const contactsPhone = siteSettings?.contacts?.phone || null
  const contactsWhatsapp = siteSettings?.contacts?.whatsapp || null
  const socialInstagram = siteSettings?.social?.instagramUrl || null
  const company = siteSettings?.company

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────── */}
      <section className="bg-brand-cream pt-12 pb-8 lg:pt-20 lg:pb-12">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/60 font-body font-medium mb-4">
            Eternal Flowers
          </p>
          <h1 className="font-display text-3xl lg:text-[2.8rem] font-light leading-tight tracking-tight text-brand-charcoal max-w-3xl">
            {content.title}
          </h1>
          <p className="mt-5 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light max-w-xl">
            {content.lastUpdated}
          </p>
        </div>
      </section>

      {/* ─── INTRODUÇÃO ───────────────────────────────── */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-brand-charcoal/70 font-body font-light text-base lg:text-lg leading-relaxed">
            {content.introduction}
          </p>
        </div>
      </Section>

      {/* ─── SECÇÕES ──────────────────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-3xl mx-auto space-y-12">
          {content.sections.slice(0, -1).map((section, i) => (
            <div key={i}>
              <h2 className="font-display text-xl lg:text-2xl font-light text-brand-charcoal mb-4">
                {section.title}
              </h2>
              <div className="text-brand-charcoal/70 font-body font-light text-sm leading-relaxed space-y-3 whitespace-pre-line">
                {section.body}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── ÚLTIMA SECÇÃO + MODELO DE FORMULÁRIO ────── */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto space-y-12">
          {content.sections.slice(-1).map((section, i) => (
            <div key={i}>
              <h2 className="font-display text-xl lg:text-2xl font-light text-brand-charcoal mb-4">
                {section.title}
              </h2>
              <p className="text-brand-charcoal/70 font-body font-light text-sm leading-relaxed mb-8">
                {section.body}
              </p>

              {/* Modelo de formulário */}
              <div className="bg-brand-cream/50 border border-brand-sage-light/20 rounded-sm p-6 lg:p-8">
                <h3 className="font-display text-lg font-light text-brand-charcoal mb-4">
                  {content.modelFormTitle}
                </h3>
                <pre className="font-body text-sm text-brand-charcoal/70 leading-relaxed whitespace-pre-wrap font-light">
                  {content.modelForm}
                </pre>
              </div>
              <p className="mt-4 text-xs text-brand-charcoal/40 font-body font-light">
                {content.modelFormNote}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── CONTACTOS ────────────────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl lg:text-3xl font-light text-brand-charcoal mb-6">
            {dict.contact}
          </h2>
          <div className="text-brand-charcoal/70 font-body font-light text-sm leading-relaxed space-y-2">
            {contactsEmail && (
              <p>
                <a
                  href={`mailto:${contactsEmail}`}
                  className="text-brand-gold hover:text-brand-gold-dark transition-colors duration-300"
                >
                  {contactsEmail}
                </a>
              </p>
            )}
            {contactsPhone && <p>{contactsPhone}</p>}
            {company?.companyName && <p className="text-xs text-brand-charcoal/50">{company.companyName}</p>}
          </div>
        </div>
      </Section>

      {/* Footer */}
      <Footer
        email={contactsEmail}
        phone={contactsPhone}
        instagramUrl={socialInstagram}
        whatsappUrl={contactsWhatsapp}
        address={company?.address}
        postalCode={company?.postalCode}
        city={company?.city}
        country={company?.country}
        locale={locale}
        dict={dict}
      />
    </>
  )
}