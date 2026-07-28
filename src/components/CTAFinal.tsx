import Button from './Button'

interface CTAFinalProps {
  title: string
  subtitle?: string | null
  buttonText: string
  buttonLink: string
  locale: string
}

export default function CTAFinal({ title, subtitle, buttonText, buttonLink, locale }: CTAFinalProps) {
  return (
    <section className="py-20 lg:py-28 bg-stone-900 text-stone-50">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h2 className="text-3xl lg:text-4xl font-light tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-4 text-lg text-stone-400 leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="mt-8">
          <Button variant="primary" href={`/${locale}${buttonLink}`}>
            {buttonText}
          </Button>
        </div>
      </div>
    </section>
  )
}