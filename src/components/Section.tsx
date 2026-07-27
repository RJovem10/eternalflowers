interface SectionProps {
  children: React.ReactNode
  className?: string
  background?: string
  containerClassName?: string
  /** Se true, o conteúdo interno fica limitado a max-w-6xl mx-auto. Default: true */
  contained?: boolean
  /** Título da secção (opcional) */
  title?: string
  /** Subtítulo da secção (opcional) */
  subtitle?: string
  /** Alinhamento do título/subtítulo */
  align?: 'left' | 'center'
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
}: SectionProps) {
  const alignClasses = align === 'center' ? 'text-center' : 'text-left'

  return (
    <section className={`py-12 lg:py-20 ${background} ${className}`}>
      <div
        className={
          contained
            ? `max-w-6xl mx-auto px-4 ${containerClassName}`
            : containerClassName
        }
      >
        {title && (
          <div className={`mb-10 lg:mb-14 ${alignClasses}`}>
            <h2 className="text-2xl lg:text-4xl font-light tracking-tight text-stone-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-3 text-lg text-stone-500 max-w-prose mx-auto">
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