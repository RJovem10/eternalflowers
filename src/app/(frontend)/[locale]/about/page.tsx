import { getDictionary } from '@/i18n/dictionaries'
import Link from 'next/link'

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale)

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-content mx-auto px-6 lg:px-8 pt-28 pb-20">
        {/* Back link */}
        <Link
          href={`/${locale}`}
          className="inline-flex items-center text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/30 hover:text-brand-gold transition-colors font-body font-medium mb-12"
        >
          ← Voltar
        </Link>

        {/* Hero heading */}
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/60 font-body font-medium mb-4">
            A Artesã
          </p>
          <h1 className="font-display text-4xl lg:text-[3.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
            Conhecer a Marina
          </h1>
          <div className="mt-6 w-12 h-[1px] bg-brand-gold/60" />
        </div>

        {/* Content placeholder — a página completa será desenvolvida numa issue futura */}
        <div className="mt-12 lg:mt-16 max-w-prose">
          <p className="text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light">
            A Marina é a artesã e naturopata por detrás da Eternal Flowers — by Mar&Natur&reg;.
            Em Braga, Portugal, transforma flores verdadeiras em joias botânicas que eternizam
            memórias.
          </p>
          <p className="mt-6 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed font-body font-light">
            Cada peça começa com uma flor verdadeira, selecionada no auge da sua beleza,
            desidratada à mão e preservada em resina. O resultado é uma joia que carrega a
            delicadeza da natureza e a alma de quem a criou.
          </p>

          <div className="mt-16 p-8 border border-brand-wood/10 bg-white/50">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/50 font-body font-medium mb-3">
              Em desenvolvimento
            </p>
            <p className="text-sm text-brand-charcoal/45 leading-relaxed font-body font-light">
              Esta página será expandida com a história completa da Marina, a sua ligação
              à naturopatia, o percurso desde a criação da Mar&Natur até à Eternal Flowers,
              e as exposições internacionais. Previsto para uma issue futura.
            </p>
          </div>

          <div className="mt-10">
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body"
            >
              {dict.catalog}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}