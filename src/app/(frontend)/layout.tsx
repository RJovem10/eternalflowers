import type { Metadata } from 'next'

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
  return <>{children}</>
}