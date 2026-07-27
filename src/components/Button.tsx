import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'accent'

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
    'inline-flex items-center px-6 py-3 rounded-full bg-stone-900 text-stone-50 text-sm font-medium tracking-wide hover:bg-stone-800 transition-colors',
  secondary:
    'inline-flex items-center px-6 py-3 rounded-full border border-stone-300 text-stone-700 text-sm font-medium tracking-wide hover:border-stone-400 hover:text-stone-900 transition-colors',
  accent:
    'inline-flex items-center px-6 py-3 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors',
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