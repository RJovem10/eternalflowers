import { locales, getDictionary } from '@/i18n/dictionaries'
import type { Locale } from '@/i18n/dictionaries'
import Header from '@/components/Header'
import CartProvider from '@/components/CartProvider'
import { notFound } from 'next/navigation'
import '@/app/globals.css'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import type { Metadata } from 'next'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const body = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'

  return {
    metadataBase: new URL(siteUrl),
    title: 'Eternal Flowers — Joias Botânicas Artesanais',
    description:
      'Joias botânicas em resina para eternizar memórias com alma. Peças únicas feitas à mão com flores reais em Portugal.',
    applicationName: 'Eternal Flowers',
  }
}

const supportedLocales = new Set<string>(locales as readonly string[])

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: candidate } = await params
  if (!supportedLocales.has(candidate)) notFound()
  const locale = candidate as Locale
  const dict = getDictionary(locale)
  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-brand-cream text-brand-charcoal font-body antialiased">
        <CartProvider>
          <Header dict={dict} locale={locale} />
          <main className="pt-16 lg:pt-20">{children}</main>
        </CartProvider>
      </body>
    </html>
  )
}