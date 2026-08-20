import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  'https://eternalflowers.pt'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  const languages: Record<string, string> = {}
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/care`
  }
  languages['x-default'] = `${siteUrl}/${defaultLocale}/care`

  return {
    title: 'Guia de Cuidados das Joias | Eternal Flowers',
    description:
      'Descubra como cuidar da sua joia botânica Eternal Flowers: água, perfume, resina, limpeza, armazenamento e cuidados para preservar a sua peça.',
    alternates: {
      canonical: `${siteUrl}/${locale}/care`,
      languages,
    },
    openGraph: {
      title: 'Guia de Cuidados das Joias | Eternal Flowers',
      description:
        'Descubra como cuidar da sua joia botânica Eternal Flowers: água, perfume, resina, limpeza, armazenamento e cuidados para preservar a sua peça.',
      locale: ({ pt: 'pt_PT', en: 'en_GB', es: 'es_ES', it: 'it_IT', de: 'de_DE' } as Record<string, string>)[locale] || 'pt_PT',
      siteName: 'Eternal Flowers',
      type: 'website',
      url: `${siteUrl}/${locale}/care`,
    },
  }
}

// Reusable section wrapper
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

// FAQ accordion item — uses native <details>/<summary> (no JS needed)
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

// Care card
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
                name: 'Posso usar a joia à chuva?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Recomendamos que não. Se se molhar acidentalmente, seque-a com o pano fornecido e deixe-a secar completamente antes de a guardar.',
                },
              },
              {
                '@type': 'Question',
                name: 'Posso usar perfume?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Sim, mas aplique-o primeiro e deixe secar antes de colocar a joia.',
                },
              },
              {
                '@type': 'Question',
                name: 'Onde devo guardar a peça?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Na caixa original, juntamente com o saquinho de sílica fornecido, num local seco e protegido da luz.',
                },
              },
              {
                '@type': 'Question',
                name: 'Como devo limpar a joia?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Apenas com o pano de limpeza fornecido.',
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
            Guia de cuidados
          </p>
          <h1 className="font-display text-3xl lg:text-[2.8rem] font-light leading-tight tracking-tight text-brand-charcoal max-w-2xl">
            Cuide da sua história
          </h1>
          <p className="mt-5 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light max-w-xl">
            Cada joia Eternal Flowers guarda uma flor verdadeira, uma memória e um
            gesto com alma. Com alguns cuidados simples, poderá preservá-la bonita
            por muito mais tempo.
          </p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-body font-medium">
            Eternal Flowers · Resin Art &amp; Jewelry by Mar&Natur&reg;
          </p>
        </div>
      </section>

      {/* ─── GUIA VISUAL APROVADO ─────────────────────── */}
      <Section className="bg-white">
        <SectionTitle>Guia visual de cuidados</SectionTitle>
        <div className="max-w-3xl mx-auto">
          <div className="relative overflow-hidden rounded-sm border border-brand-sage-light/20 bg-brand-cream/30">
            <Image
              src="/images/guides/eternal-flowers-care-guide-pt.png"
              alt="Guia visual de cuidados para joias botânicas Eternal Flowers"
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
              Guardar guia
            </a>
            <a
              href="/images/guides/eternal-flowers-care-guide-pt.png"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-transparent border border-brand-gold/40 text-brand-gold text-sm font-medium tracking-wider uppercase hover:bg-brand-gold/10 hover:border-brand-gold transition-all duration-300 font-body"
            >
              Abrir imagem
            </a>
          </div>
        </div>
      </Section>

      {/* ─── 5 CUIDADOS ESSENCIAIS ────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-3xl mx-auto">
          <SectionTitle>5 cuidados essenciais</SectionTitle>
          <div className="space-y-4">
            <CareCard
              number="1"
              title="Mantenha a peça seca"
              text="Evite água, humidade e chuva. Retire a joia antes do banho, piscina, praia ou sempre que houver risco de se molhar."
            />
            <CareCard
              number="2"
              title="Perfume primeiro. Joia depois."
              text="Perfumes, cremes e outros produtos devem secar antes de colocar a peça. Evite o contacto direto com cosméticos, álcool ou produtos de limpeza."
            />
            <CareCard
              number="3"
              title="Proteja-a do sol e do calor"
              text="Evite exposição prolongada ao sol e a fontes de calor. O calor excessivo pode afetar a resina e a beleza da peça ao longo do tempo."
            />
            <CareCard
              number="4"
              title="Use com delicadeza"
              text="Evite quedas, puxões e pressão sobre a joia. Não recomendamos dormir, praticar desporto ou realizar tarefas exigentes com a peça colocada."
            />
            <CareCard
              number="5"
              title="Guarde-a com carinho"
              text="Quando não estiver a usar a joia, guarde-a na caixa original. Mantenha-a seca, protegida da luz e com o saquinho de sílica fornecido, para ajudar a controlar a humidade."
            />
          </div>
        </div>
      </Section>

      {/* ─── LIMPEZA ──────────────────────────────────── */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <SectionTitle>Limpeza suave</SectionTitle>
          <p className="text-brand-charcoal/65 font-body font-light text-base lg:text-lg leading-relaxed max-w-lg mx-auto">
            Para limpar a sua peça, use apenas o pano de limpeza fornecido.
            Evite produtos abrasivos, álcool, perfumes ou panos húmidos.
          </p>
        </div>
      </Section>

      {/* ─── SE A PEÇA SE MOLHAR ─────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-lavender/20 flex items-center justify-center text-2xl">
            💧
          </div>
          <SectionTitle>Se a peça se molhar acidentalmente</SectionTitle>
          <p className="text-brand-charcoal/65 font-body font-light text-base lg:text-lg leading-relaxed max-w-lg mx-auto">
            Seque-a suavemente com o pano fornecido e deixe-a secar completamente
            antes de a guardar.
          </p>
        </div>
      </Section>

      {/* ─── GARANTIA ─────────────────────────────────── */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <SectionTitle>A sua peça tem garantia</SectionTitle>
          <p className="text-brand-charcoal/65 font-body font-light text-base lg:text-lg leading-relaxed max-w-lg mx-auto mb-8">
            A sua joia Eternal Flowers foi criada com carinho e atenção ao
            detalhe. Se notar algum problema com a peça, entre em contacto
            connosco — teremos todo o gosto em ajudar.
          </p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '351000000000'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
          >
            Falar connosco
          </a>
          <p className="mt-6 text-xs text-brand-charcoal/35 font-body font-light max-w-md mx-auto">
            Este guia ajuda a conservar a sua joia e não limita os direitos legais
            do consumidor.
          </p>
        </div>
      </Section>

      {/* ─── FAQ ──────────────────────────────────────── */}
      <Section className="bg-brand-cream">
        <div className="max-w-2xl mx-auto">
          <SectionTitle>Perguntas frequentes</SectionTitle>
          <div className="bg-white rounded-sm px-4 lg:px-8">
            <FaqItem
              question="Posso usar a joia à chuva?"
              answer="Recomendamos que não. Se se molhar acidentalmente, seque-a com o pano fornecido e deixe-a secar completamente antes de a guardar."
            />
            <FaqItem
              question="Posso usar perfume?"
              answer="Sim, mas aplique-o primeiro e deixe secar antes de colocar a joia."
            />
            <FaqItem
              question="Onde devo guardar a peça?"
              answer="Na caixa original, juntamente com o saquinho de sílica fornecido, num local seco e protegido da luz."
            />
            <FaqItem
              question="Como devo limpar a joia?"
              answer="Apenas com o pano de limpeza fornecido."
            />
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
            Agora que sabe como cuidar dela, continue a descobrir a nossa
            história.
          </h2>
          <div className="mt-10 lg:mt-12">
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
            >
              Descobrir a coleção
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}