import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import { aboutContent } from '@/content/about'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const content = aboutContent[locale] || aboutContent.pt

  const languages: Record<string, string> = {}
  for (const l of locales) {
    languages[l] = `/${l}/about`
  }
  languages['x-default'] = `/${defaultLocale}/about`

  return {
    title: content.meta.title,
    description: content.meta.description,
    alternates: {
      canonical: `/${locale}/about`,
      languages,
    },
    openGraph: {
      title: content.meta.title,
      description: content.meta.description,
      images: [{ url: '/marina/marina-hero-orquidea-rosa.jpeg' }],
      locale: locale === 'pt' ? 'pt_PT' : locale === 'en' ? 'en_GB' : locale,
    },
  }
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const dict = getDictionary(locale)
  const content = aboutContent[locale] || aboutContent.pt

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 1 — HERO EDITORIAL
          Imagem: marina-hero-orquidea-rosa.jpeg
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] lg:min-h-screen bg-brand-cream flex flex-col lg:flex-row overflow-hidden">
        {/* Lado esquerdo: texto */}
        <div className="relative z-10 w-full lg:w-1/2 flex items-center">
          <div className="w-full max-w-lg mx-auto px-6 lg:px-12 xl:px-16 pt-28 lg:pt-20 pb-16 lg:pb-0">
            <div className="inline-flex items-center gap-2.5 mb-8 lg:mb-10">
              <span className="w-1 h-1 rounded-full bg-brand-gold" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                {content.hero.label}
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[4rem] xl:text-[4.5rem] font-light leading-[1.05] tracking-tight text-brand-charcoal">
              {content.hero.title}
            </h1>

            <div className="mt-8 lg:mt-10 w-12 h-[1px] bg-brand-gold/60" />

            <p className="mt-6 lg:mt-8 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed max-w-md font-body font-light">
              {content.hero.subtitle}
            </p>

            <div className="mt-16 lg:mt-20 flex items-center gap-4 text-brand-charcoal/25">
              <span className="text-[10px] uppercase tracking-[0.2em] font-body font-medium">
                Eternal Flowers
              </span>
              <span className="w-6 h-[1px] bg-brand-charcoal/15" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-body font-medium">
                by Mar&Natur&reg;
              </span>
            </div>
          </div>
        </div>

        {/* Lado direito: fotografia hero */}
        <div className="relative w-full lg:w-1/2 min-h-[55vh] lg:min-h-screen bg-brand-charcoal/5 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/marina/marina-hero-orquidea-rosa.jpeg"
              alt="Marina, fundadora da Eternal Flowers, com uma orquídea rosa ao peito"
              fill
              className="object-cover object-[50%_30%]"
              sizes="50vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-brand-cream/15" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-brand-cream/5" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-brand-cream to-transparent lg:hidden" />
        </div>

        {/* Scroll indicator */}
        <div className="hidden lg:flex absolute bottom-10 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-brand-charcoal/20 z-20">
          <span className="text-[9px] uppercase tracking-[0.3em] font-body font-light">Scroll</span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-brand-charcoal/30 to-transparent" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 2 — PERCURSO ENTRE CIÊNCIA E CUIDADO
          Imagem: marina-terapeuta-bata-branca.jpeg
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Texto */}
            <div>
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section2.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section2.title}
              </h2>
              <div className="mt-6 w-12 h-[1px] bg-brand-gold/60" />
              <div className="mt-8 space-y-5">
                {content.section2.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>

            {/* Imagem */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-brand-charcoal/5">
              <Image
                src="/marina/marina-terapeuta-bata-branca.jpeg"
                alt="Marina com bata branca num retrato profissional"
                fill
                className="object-cover object-[50%_30%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 3 — FORMAÇÃO E MUDANÇA PARA NATUROPATIA E OSTEOPATIA
          Secção sem fotografia — texto com respiro
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-cream py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 lg:mb-16">
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section3.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section3.title}
              </h2>
              <div className="mt-6 mx-auto w-12 h-[1px] bg-brand-gold/60" />
            </div>
            <div className="space-y-5 max-w-prose mx-auto">
              {content.section3.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 4 — CRIAÇÃO DA MAR&NATUR
          Secção sem fotografia — texto com respiro
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 lg:mb-16">
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section4.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section4.title}
              </h2>
              <div className="mt-6 mx-auto w-12 h-[1px] bg-brand-gold/60" />
            </div>
            <div className="space-y-5 max-w-prose mx-auto">
              {content.section4.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 5 — ORIGEM DA ETERNAL FLOWERS
          Imagem: marina-artesa-orquideas.jpeg
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-cream py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Imagem */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-brand-charcoal/5 lg:order-2">
              <Image
                src="/marina/marina-artesa-orquideas.jpeg"
                alt="Marina a trabalhar com orquídeas, uma tesoura e um tabuleiro de madeira"
                fill
                className="object-cover object-[60%_50%] lg:object-[60%_50%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            {/* Texto */}
            <div className="lg:order-1">
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section5.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section5.title}
              </h2>
              <div className="mt-6 w-12 h-[1px] bg-brand-gold/60" />
              <div className="mt-8 space-y-5">
                {content.section5.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 6 — APRENDIZAGEM E PROCESSO ARTESANAL
          Imagem: marina-processo-tesoura-orquidea.jpeg
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Texto */}
            <div>
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section6.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section6.title}
              </h2>
              <div className="mt-6 w-12 h-[1px] bg-brand-gold/60" />
              <div className="mt-8 space-y-5">
                {content.section6.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>

            {/* Imagem */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-brand-charcoal/5">
              <Image
                src="/marina/marina-processo-tesoura-orquidea.jpeg"
                alt="Mão a segurar uma tesoura junto a uma orquídea roxa"
                fill
                className="object-cover object-[50%_40%] lg:object-[50%_40%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 6B — IMAGEM DE RITMO VISUAL (OPCIONAL)
          Imagem: marina-detalhe-ferramentas.jpeg
          Usada — acrescenta valor real, distinta da imagem da tesoura
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-charcoal/[0.02]">
        <div className="max-w-content mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <div className="relative aspect-[16/9] lg:aspect-[3/1] w-full overflow-hidden bg-brand-charcoal/5">
            <Image
              src="/marina/marina-detalhe-ferramentas.jpeg"
              alt="Tesouras douradas e orquídeas sobre uma bandeja de bambu"
              fill
              className="object-cover object-[50%_55%] lg:object-[50%_55%]"
              sizes="100vw"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 7 — EXPOSIÇÕES EM PORTUGAL E ESPANHA
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-cream py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 lg:mb-16">
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section7.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section7.title}
              </h2>
              <div className="mt-6 mx-auto w-12 h-[1px] bg-brand-gold/60" />
            </div>
            <div className="space-y-5 max-w-prose mx-auto">
              {content.section7.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 8 — A PESSOA POR DETRÁS DE CADA PEÇA
          Imagem: marina-retrato-natureza.jpeg
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Imagem */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-brand-charcoal/5 lg:order-2">
              <Image
                src="/marina/marina-retrato-natureza.jpeg"
                alt="Marina ao ar livre junto a uma árvore"
                fill
                className="object-cover object-[50%_35%] lg:object-[50%_35%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            {/* Texto */}
            <div className="lg:order-1">
              <div className="inline-flex items-center gap-2.5 mb-6">
                <span className="w-1 h-1 rounded-full bg-brand-gold" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
                  {content.section8.label}
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
                {content.section8.title}
              </h2>
              <div className="mt-6 w-12 h-[1px] bg-brand-gold/60" />
              <div className="mt-8 space-y-5">
                {content.section8.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 9 — CITAÇÃO FINAL
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-charcoal py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <span className="font-display text-6xl lg:text-8xl text-brand-gold/20 leading-none block mb-6">
              &ldquo;
            </span>
            <blockquote className="font-display text-2xl lg:text-[2rem] font-light leading-relaxed text-white/90">
              {content.quote.text}
            </blockquote>
            <div className="mt-8 mx-auto w-12 h-[1px] bg-brand-gold/40" />
            <cite className="mt-6 block text-sm text-white/40 font-body font-light not-italic">
              &mdash; {content.quote.author}
            </cite>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECÇÃO 10 — CTA "DESCOBRIR AS PEÇAS"
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-cream py-20 lg:py-28">
        <div className="max-w-content mx-auto px-6 lg:px-8 text-center">
          <div className="max-w-lg mx-auto">
            <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
              {content.cta.heading}
            </h2>
            <div className="mt-6 mx-auto w-12 h-[1px] bg-brand-gold/60" />
            <p className="mt-6 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light">
              {content.hero.subtitle}
            </p>
            <div className="mt-10">
              <Link
                href={`/${locale}${content.cta.link}`}
                className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
              >
                {content.cta.text}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}