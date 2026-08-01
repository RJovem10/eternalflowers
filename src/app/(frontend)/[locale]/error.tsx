'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { getDictionary } from '@/i18n/dictionaries'
import { getLocaleFromPathname } from '@/i18n/get-locale-from-pathname'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const dict = getDictionary(locale)

  console.error('Error boundary caught:', error.message)

  return (
    <div className="mx-auto max-w-content px-6 py-24 text-center lg:py-32">
      <h1 className="font-display text-3xl font-light text-brand-charcoal lg:text-4xl">
        {dict.genericErrorTitle}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-brand-charcoal/60">
        {dict.genericErrorMessage}
      </p>
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <button
          onClick={reset}
          className="bg-brand-gold px-6 py-3 text-sm font-medium text-white uppercase tracking-[0.1em] transition-colors duration-300 hover:bg-brand-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
        >
          {dict.tryAgain}
        </button>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center border-b border-brand-gold/50 pb-1 text-xs uppercase tracking-[0.16em] text-brand-charcoal/65 transition-colors duration-300 hover:border-brand-gold-dark hover:text-brand-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
        >
          {dict.backToHome}
        </Link>
      </div>
    </div>
  )
}