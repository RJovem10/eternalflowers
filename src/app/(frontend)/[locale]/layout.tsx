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

// generateStaticParams removido para permitir build em Docker sem DB.
// As páginas sob [locale] são server-rendered on demand, o que é
// o comportamento correcto para produção com PostgreSQL.
// O locale route segment funciona sem generateStaticParams.

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      'https://eternalflowers.pt'
  ),
  title: 'Eternal Flowers Portugal — Joias Botânicas Artesanais com Orquídeas Naturais',
  description:
    'Joias botânicas artesanais com flores naturais verdadeiras, preservadas em resina. Peças únicas feitas à mão em Portugal pela Marina. Brincos, colares e pingentes com orquídeas reais.',
  applicationName: 'Eternal Flowers',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'Eternal Flowers Portugal',
    'joias botânicas',
    'joalharia botânica',
    'joias com orquídeas',
    'joias com flores naturais',
    'joias com flores verdadeiras',
    'orquídeas em resina',
    'flores preservadas em resina',
    'brincos botânicos',
    'colares botânicos',
    'pingentes botânicos',
    'joias artesanais Portugal',
    'botanical jewellery',
    'orchid jewellery',
    'real flower jewellery',
  ],
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