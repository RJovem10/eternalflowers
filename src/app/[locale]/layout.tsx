import { locales, getDictionary, defaultLocale } from '@/i18n/dictionaries'
import Header from '@/components/Header'
import CartProvider from '@/components/CartProvider'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale as any)) notFound()
  const dict = getDictionary(locale)
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <CartProvider>
          <Header dict={dict} locale={locale} />
          <main className="max-w-6xl mx-auto px-4">{children}</main>
        </CartProvider>
      </body>
    </html>
  )
}
