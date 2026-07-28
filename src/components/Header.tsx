'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { locales, localeNames, type Locale } from '@/i18n/dictionaries'
import { useCart } from './CartProvider'

export default function Header({
  dict,
  locale,
}: {
  dict: any
  locale: string
}) {
  const pathname = usePathname()
  const { count } = useCart()

  function changeLocale(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    const segments = pathname.split('/')
    segments[1] = newLocale
    window.location.href = segments.join('/') || `/${newLocale}`
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand-cream/90 backdrop-blur-md border-b border-brand-wood/10">
      <div className="max-w-content mx-auto px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-3 group"
        >
          <span className="text-2xl">🌺</span>
          <div>
            <span className="font-display text-lg font-light tracking-wide text-brand-charcoal group-hover:text-brand-gold transition-colors">
              Eternal Flowers
            </span>
            <span className="hidden lg:block text-[10px] uppercase tracking-[0.2em] text-brand-wood/60 font-body font-light">
              Resin Art &amp; Jewelry
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href={`/${locale}`}
            className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/70 hover:text-brand-gold transition-colors font-body font-medium"
          >
            {dict.home}
          </Link>
          <Link
            href={`/${locale}/catalog`}
            className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/70 hover:text-brand-gold transition-colors font-body font-medium"
          >
            {dict.catalog}
          </Link>
          <Link
            href={`/${locale}/cart`}
            className="relative text-xs uppercase tracking-[0.15em] text-brand-charcoal/70 hover:text-brand-gold transition-colors font-body font-medium"
          >
            {dict.cart}
            {count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center bg-brand-gold text-white text-[10px] font-semibold rounded-full w-4 h-4">
                {count}
              </span>
            )}
          </Link>
          <Link
            href="/admin"
            className="text-[10px] uppercase tracking-[0.15em] text-brand-wood/40 hover:text-brand-charcoal/60 transition-colors font-body"
          >
            {dict.admin}
          </Link>
        </nav>

        {/* Right: Locale + Mobile menu */}
        <div className="flex items-center gap-3">
          <select
            value={locale}
            onChange={changeLocale}
            aria-label={dict.language}
            className="bg-transparent border-none text-[11px] uppercase tracking-[0.1em] text-brand-wood/60 font-body font-medium cursor-pointer focus:outline-none"
          >
            {locales.map((l: string) => (
              <option key={l} value={l}>
                {(localeNames as Record<string, string>)[l] || l}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}