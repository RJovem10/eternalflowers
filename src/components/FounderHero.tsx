import Image from 'next/image'
import Button from './Button'

interface FounderHeroProps {
  heroTitle?: string
  heroSubtitle?: string
  locale?: string
  dict: any
}

/**
 * Proposta A — Editorial Split
 *
 * Composição inspirada em editoriais de luxo (Vogue, Architectural Digest).
 * Metade esquerda: texto com respiro generoso.
 * Metade direita: fotografia da Marina, full-height, em formato vertical.
 *
 * A fotografia (marina-hero.jpg) é um still de vídeo do Instagram
 * que mostra a Marina no atelier, com avental floral, a documentar
 * o processo de desidratação de uma Sobrália.
 */

export default function FounderHero({
  heroTitle = 'Joias Botânicas\nFeitas à Mão',
  heroSubtitle = 'Cada peça é uma história que o tempo não apaga. Flores verdadeiras, eternizadas em resina pela Marina, em Braga.',
  locale = 'pt',
  dict,
}: FounderHeroProps) {
  return (
    <section className="relative min-h-screen bg-brand-cream flex flex-col lg:flex-row overflow-hidden">
      {/* ─── LADO ESQUERDO: TEXTO ─── */}
      <div className="relative z-10 w-full lg:w-1/2 flex items-center">
        <div className="w-full max-w-lg mx-auto px-6 lg:px-12 xl:px-16 pt-24 lg:pt-20 pb-20 lg:pb-0">
          {/* Badge de entrada */}
          <div className="inline-flex items-center gap-2.5 mb-8 lg:mb-10">
            <span className="w-1 h-1 rounded-full bg-brand-gold" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-brand-charcoal/40 font-body font-medium">
              Artesanato · Braga · Portugal
            </span>
          </div>

          {/* Headline — emocional, em duas linhas */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[4rem] xl:text-[4.5rem] font-light leading-[1.05] tracking-tight text-brand-charcoal whitespace-pre-line">
            {heroTitle}
          </h1>

          {/* Linha dourada decorativa */}
          <div className="mt-8 lg:mt-10 w-12 h-[1px] bg-brand-gold/60" />

          {/* Subtítulo — máximo 3 linhas */}
          <p className="mt-6 lg:mt-8 text-base lg:text-lg text-brand-charcoal/60 leading-relaxed max-w-sm font-body font-light">
            {heroSubtitle}
          </p>

          {/* CTAs */}
          <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-4">
            <Button variant="primary" href={`/${locale}/catalog`}>
              Descobrir Coleções
            </Button>
            <Button variant="secondary" href={`/${locale}/about`}>
              Conhecer a Marina
            </Button>
          </div>

          {/* Assinatura visual */}
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

      {/* ─── LADO DIREITO: FOTOGRAFIA DA MARINA ─── */}
      <div className="relative w-full lg:w-1/2 min-h-[60vh] lg:min-h-screen bg-brand-charcoal/5 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/marina-hero.jpg"
            alt="Marina no atelier Eternal Flowers, a trabalhar na desidratação de orquídeas"
            fill
            className="object-cover object-[center_30%]"
            sizes="50vw"
            priority
          />
          {/* Overlay gradiente suave para unificar a imagem com o fundo creme */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-brand-cream/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-brand-cream/5" />
        </div>

        {/* Overlay subtil na base da imagem (mobile) */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-brand-cream to-transparent lg:hidden" />
      </div>

      {/* Scroll indicator — apenas visível em desktop */}
      <div className="hidden lg:flex absolute bottom-10 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-brand-charcoal/20 z-20">
        <span className="text-[9px] uppercase tracking-[0.3em] font-body font-light">{dict.scroll}</span>
        <div className="w-[1px] h-10 bg-gradient-to-b from-brand-charcoal/30 to-transparent" />
      </div>
    </section>
  )
}