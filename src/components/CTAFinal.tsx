import Button from './Button'

interface CTAFinalProps {
  title: string
  subtitle?: string | null
  buttonText: string
  buttonLink: string
  locale: string
}

function safeLink(link: string | undefined | null): string {
  if (!link || link === 'undefined' || link === 'null') return '/'
  return link.startsWith('/') ? link : `/${link}`
}

export default function CTAFinal({ title, subtitle, buttonText, buttonLink, locale }: CTAFinalProps) {
  return (
    <section className="py-24 lg:py-32 bg-brand-charcoal text-white relative overflow-hidden">
      {/* Background decoration — textura subtil de fundo */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 25% 50%, #D4A853 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 lg:px-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/50 font-body font-medium mb-5">
          Eternize uma Memória
        </p>
        <h2 className="font-display text-3xl lg:text-[3rem] font-light leading-tight tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-5 text-base lg:text-lg text-white/45 leading-relaxed font-body font-light max-w-md mx-auto">
            {subtitle}
          </p>
        )}
        <div className="mt-10 lg:mt-12">
          <Button variant="primary" href={`/${locale}${safeLink(buttonLink)}`}>
            {buttonText}
          </Button>
        </div>
      </div>
    </section>
  )
}