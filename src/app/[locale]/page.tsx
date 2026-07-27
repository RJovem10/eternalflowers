import { getPayloadClient } from '@/payload'
import Hero from '@/components/Hero'

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const payload = await getPayloadClient()
  const homepage = await payload.findGlobal({ slug: 'homepage' })
  const hero = homepage.hero

  return (
    <div>
      <Hero
        heroImage={hero.heroImage}
        heroTitle={hero.heroTitle}
        heroSubtitle={hero.heroSubtitle}
        primaryButtonText={hero.primaryButtonText}
        primaryButtonLink={hero.primaryButtonLink}
        secondaryButtonText={hero.secondaryButtonText}
        secondaryButtonLink={hero.secondaryButtonLink}
        locale={locale}
      />
    </div>
  )
}