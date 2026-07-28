import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonBaseProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

interface ButtonAsButton extends ButtonBaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {
  href?: undefined
}

interface ButtonAsLink extends ButtonBaseProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> {
  href: string
}

type ButtonProps = ButtonAsButton | ButtonAsLink

const variantStyles: Record<Variant, string> = {
  primary:
    'inline-flex items-center px-8 py-3.5 bg-brand-gold text-white text-sm font-medium tracking-wider uppercase hover:bg-brand-gold-dark transition-all duration-300 font-body',
  secondary:
    'inline-flex items-center px-8 py-3.5 bg-transparent border border-brand-gold/40 text-brand-gold text-sm font-medium tracking-wider uppercase hover:bg-brand-gold/10 hover:border-brand-gold transition-all duration-300 font-body',
  ghost:
    'inline-flex items-center px-8 py-3.5 bg-transparent border border-white/30 text-white/80 text-sm font-medium tracking-wider uppercase hover:bg-white/10 hover:text-white hover:border-white/50 transition-all duration-300 font-body',
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = 'primary', children, className = '', ...props }, ref) => {
    const classes = `${variantStyles[variant]} ${className}`

    if ('href' in props && props.href) {
      const { href, ...rest } = props as ButtonAsLink
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={classes}
          {...(rest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'>)}
        >
          {children}
        </Link>
      )
    }

    const { ...rest } = props as ButtonAsButton
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...(rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>)}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

export { Button, type Variant }
export default Button