'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionaries'
import { getLocaleFromPathname } from '@/i18n/get-locale-from-pathname'

export default function NotFound() {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const dict = getDictionary(locale)

  return (
    <div className="mx-auto max-w-content px-6 py-24 text-center lg:py-32">
      <span className="text-7xl font-light text-brand-gold/30 select-none" aria-hidden="true">
        404
      </span>
      <h1 className="mt-6 font-display text-3xl font-light text-brand-charcoal lg:text-4xl">
        {dict.pageNotFoundTitle}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-brand-charcoal/60">
        {dict.pageNotFoundMessage}
      </p>
      <Link
        href={`/${locale}`}
        className="mt-10 inline-flex items-center border-b border-brand-gold/50 pb-1 text-xs uppercase tracking-[0.16em] text-brand-charcoal/65 transition-colors duration-300 hover:border-brand-gold-dark hover:text-brand-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
      >
        {dict.backToHome}
      </Link>
    </div>
  )
}