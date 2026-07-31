import { getDictionary, locales, defaultLocale } from '@/i18n/dictionaries'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const dict = getDictionary(locale)

  return {
    title: `${dict.checkout} — Eternal Flowers`,
    robots: { index: false, follow: false },
  }
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}