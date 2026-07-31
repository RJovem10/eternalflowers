'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { locales, localeNames, type Locale } from '@/i18n/dictionaries'
import { useCart } from './CartProvider'

function LocaleSelector({
  locale,
  label,
  onChange,
}: {
  locale: string
  label: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
  return (
    <select
      value={locale}
      onChange={onChange}
      aria-label={label}
      className="bg-transparent border-none text-[11px] uppercase tracking-[0.1em] text-brand-wood/60 font-body font-medium cursor-pointer focus:outline-none"
    >
      {locales.map((l: Locale) => (
        <option key={l} value={l}>
          {localeNames[l]}
        </option>
      ))}
    </select>
  )
}

export default function Header({
  dict,
  locale,
}: {
  dict: any
  locale: string
}) {
  const pathname = usePathname()
  const { count } = useCart()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMobileMenu()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMobileMenu, isMobileMenuOpen])

  function changeLocale(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    const segments = pathname.split('/')
    segments[1] = newLocale
    window.location.href = segments.join('/') || `/${newLocale}`
  }

  return (
    <>
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
            <LocaleSelector
              locale={locale}
              label={dict.language}
              onChange={changeLocale}
            />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              aria-label={isMobileMenuOpen ? dict.closeMenu : dict.openMenu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center text-brand-charcoal hover:text-brand-gold transition-colors duration-300"
            >
              {isMobileMenuOpen ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className="h-6 w-6"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className="h-6 w-6"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile navigation — OUTSIDE header to avoid stacking context issues */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-brand-charcoal/20 transition-opacity duration-300 ${
          isMobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: '64px' }}
        onClick={closeMobileMenu}
        aria-hidden={!isMobileMenuOpen}
      >
        <nav
          id="mobile-navigation"
          aria-label={dict.mobileNavLabel}
          className={`ml-auto h-full w-full max-w-xs overflow-y-auto bg-brand-cream text-brand-charcoal transition-transform duration-300 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col px-6 py-8">
            <Link
              href={`/${locale}`}
              onClick={closeMobileMenu}
              className="px-3 py-4 text-xs uppercase tracking-[0.15em] hover:text-brand-gold transition-colors duration-300 font-body font-medium"
            >
              {dict.home}
            </Link>
            <Link
              href={`/${locale}/catalog`}
              onClick={closeMobileMenu}
              className="px-3 py-4 text-xs uppercase tracking-[0.15em] hover:text-brand-gold transition-colors duration-300 font-body font-medium"
            >
              {dict.catalog}
            </Link>
            <Link
              href={`/${locale}/cart`}
              onClick={closeMobileMenu}
              className="flex items-center px-3 py-4 text-xs uppercase tracking-[0.15em] hover:text-brand-gold transition-colors duration-300 font-body font-medium"
            >
              {dict.cart}
              {count > 0 && (
                <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-gold text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
            <Link
              href="/admin"
              onClick={closeMobileMenu}
              className="px-3 py-4 text-xs uppercase tracking-[0.15em] hover:text-brand-gold transition-colors duration-300 font-body font-medium"
            >
              {dict.admin}
            </Link>

            <div className="mt-4 border-t border-brand-wood/10 px-3 pt-6">
              <LocaleSelector
                locale={locale}
                label={dict.language}
                onChange={changeLocale}
              />
            </div>
          </div>
        </nav>
      </div>
    </>
  )
}
