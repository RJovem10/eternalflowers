import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://eternalflowers.pt'

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: 'Eternal Flowers Portugal — Joias Botânicas Artesanais com Orquídeas Naturais',
      template: '%s — Eternal Flowers',
    },
    description:
      'Joias botânicas artesanais com flores naturais verdadeiras, preservadas em resina. Peças únicas feitas à mão em Portugal pela Marina. Brincos, colares e pingentes com orquídeas reais.',
    applicationName: 'Eternal Flowers',
  }
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}