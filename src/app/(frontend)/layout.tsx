import '../globals.css'
import { Cormorant_Garamond, Inter } from 'next/font/google'

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

export const metadata = {
  title: 'Eternal Flowers — Joias Botânicas Artesanais',
  description:
    'Joias botânicas em resina para eternizar memórias com alma. Peças únicas feitas à mão com flores reais em Portugal.',
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