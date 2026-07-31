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
    title: `${dict.cart} — Eternal Flowers`,
    robots: { index: false, follow: false },
  }
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}