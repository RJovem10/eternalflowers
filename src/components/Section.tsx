interface SectionProps {
  children: React.ReactNode
  className?: string
  background?: string
  containerClassName?: string
  /** Se true, o conteúdo interno fica limitado a max-w-content mx-auto. Default: true */
  contained?: boolean
  /** Título da secção (opcional) */
  title?: string
  /** Subtítulo da secção (opcional) */
  subtitle?: string
  /** Alinhamento do título/subtítulo */
  align?: 'left' | 'center'
  /** Se true, mostra uma linha dourada decorativa abaixo do título */
  goldLine?: boolean
  /** Tamanho visual da secção: 'default' | 'large' | 'compact' | 'hero' */
  size?: 'default' | 'large' | 'compact'
  /** Remove a linha dourada automática (para quando queres control manual) */
  noGold?: boolean
}

const sizeSpacing: Record<string, string> = {
  default: 'py-16 lg:py-24',
  large: 'py-20 lg:py-28',
  compact: 'py-12 lg:py-16',
}

const titleSizes: Record<string, string> = {
  default: 'text-3xl lg:text-[2.5rem]',
  large: 'text-3xl lg:text-[3rem]',
  compact: 'text-2xl lg:text-[2rem]',
}

export default function Section({
  children,
  className = '',
  background = '',
  containerClassName = '',
  contained = true,
  title,
  subtitle,
  align = 'left',
  goldLine = true,
  size = 'default',
  noGold = false,
}: SectionProps) {
  const alignClasses = align === 'center' ? 'text-center' : 'text-left'
  const showGold = goldLine && !noGold

  return (
    <section className={`${sizeSpacing[size]} ${background} ${className}`}>
      <div
        className={
          contained
            ? `max-w-content mx-auto px-6 lg:px-8 ${containerClassName}`
            : containerClassName
        }
      >
        {title && (
          <div className={`mb-10 lg:mb-14 ${alignClasses}`}>
            <h2
              className={`font-display ${titleSizes[size]} font-light leading-tight tracking-tight text-brand-charcoal`}
            >
              {title}
            </h2>
            {showGold && (
              <div
                className={`mt-4 w-12 h-[1px] bg-brand-gold/50 ${
                  align === 'center' ? 'mx-auto' : ''
                }`}
              />
            )}
            {subtitle && (
              <p
                className={`mt-5 text-base lg:text-lg text-brand-charcoal/55 leading-relaxed max-w-lg ${
                  align === 'center' ? 'mx-auto' : ''
                } font-body font-light`}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}