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
    // reescreve o path com a nova língua
    const segments = pathname.split('/')
    segments[1] = newLocale
    window.location.href = segments.join('/') || `/${newLocale}`
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="text-xl font-semibold tracking-tight">
          🌸 {dict.brand}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/${locale}`} className="hover:underline">{dict.home}</Link>
          <Link href={`/${locale}/catalog`} className="hover:underline">{dict.catalog}</Link>
          <Link href={`/${locale}/cart`} className="hover:underline relative">
            {dict.cart}
            {count > 0 && (
              <span className="ml-1 inline-flex items-center justify-center bg-rose-600 text-white text-xs rounded-full w-5 h-5">
                {count}
              </span>
            )}
          </Link>
          <Link href="/admin" className="text-stone-400 hover:text-stone-700 text-xs">{dict.admin}</Link>
          <select
            value={locale}
            onChange={changeLocale}
            aria-label={dict.language}
            className="border border-stone-300 rounded-md px-2 py-1 text-sm bg-white"
          >
            {locales.map((l: Locale) => (
              <option key={l} value={l}>{localeNames[l]}</option>
            ))}
          </select>
        </nav>
      </div>
    </header>
  )
}
