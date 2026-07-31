import '../globals.css'
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

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-brand-cream text-brand-charcoal font-body antialiased">
        {children}
      </body>
    </html>
  )
}