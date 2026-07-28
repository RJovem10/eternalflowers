import { getPayloadClient } from '@/payload'
import { getDictionary } from '@/i18n/dictionaries'
import Hero from '@/components/Hero'
import RealFlowers from '@/components/RealFlowers'
import CategoriesSection from '@/components/CategoriesSection'
import CollectionsSection from '@/components/CollectionsSection'
import StorySection from '@/components/StorySection'
import MarinaPicks from '@/components/MarinaPicks'
import InternationalPresence from '@/components/InternationalPresence'
import InstagramSection from '@/components/InstagramSection'
import CTAFinal from '@/components/CTAFinal'
import Footer from '@/components/Footer'

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale)
  const payload = await getPayloadClient()
  const homepage = await payload.findGlobal({ slug: 'homepage' })

  const [categoriesData, collectionsData, flowersData] = await Promise.all([
    payload.find({ collection: 'categories', limit: 20, sort: 'name' }),
    payload.find({
      collection: 'collections',
      limit: 20,
      sort: 'name',
      where: { isActive: { equals: true } },
    }),
    payload.find({ collection: 'flowers', limit: 8, sort: '-createdAt' }),
  ])

  const hero = homepage.hero
  const realFlowers = homepage.realFlowers
  const story = homepage.story
  const international = homepage.international
  const instagram = homepage.instagram
  const cta = homepage.cta
  const footer = homepage.footer

  const nfName =
    ({ pt: 'namePt', en: 'nameEn', es: 'nameEs', it: 'nameIt', de: 'nameDe' }[locale] || 'namePt') as string

  return (
    <div>
      <Hero
        heroImage={hero.heroImage}
        heroTitle={hero.heroTitle}
        heroSubtitle={hero.heroSubtitle}
        primaryButtonText={hero.primaryButtonText}
        primaryButtonLink={hero.primaryButtonLink || '/'}
        secondaryButtonText={hero.secondaryButtonText}
        secondaryButtonLink={hero.secondaryButtonLink || '/'}
        locale={locale}
      />

      <RealFlowers
        title={realFlowers?.title || 'Flores Verdadeiras'}
        subtitle={realFlowers?.subtitle}
      />

      <CategoriesSection
        categories={categoriesData.docs.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
        }))}
        locale={locale}
      />

      <CollectionsSection
        collections={collectionsData.docs.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: c.image,
        }))}
        locale={locale}
      />

      <StorySection
        title={story?.title || 'Do efémero ao eterno'}
        text={story?.text || 'Cada peça é uma história. Das nossas mãos para as suas, transformamos flores verdadeiras em joias que duram para sempre.'}
        image={story?.image}
      />

      <MarinaPicks
        flowers={flowersData.docs.map((f: any) => ({
          id: f.id,
          name: f[nfName] || f.namePt || '—',
          price: f.price,
          image: f.image,
        }))}
        locale={locale}
        dict={dict}
      />

      <InternationalPresence
        title={international?.title || 'Presença Internacional'}
        subtitle={international?.subtitle}
      />

      <InstagramSection
        title={instagram?.title || 'Siga-nos no Instagram'}
        handle={instagram?.handle || 'eternal.flowers.pt'}
        text={instagram?.text || 'Acompanhe o nosso dia-a-dia, bastidores e novidades em primeira mão.'}
      />

      <CTAFinal
        title={cta?.title || 'Pronta para eternizar uma memória?'}
        subtitle={cta?.subtitle}
        buttonText={cta?.buttonText || 'Fale connosco'}
        buttonLink={cta?.buttonLink || '/catalog'}
        locale={locale}
      />

      <Footer
        brandDescription={footer?.brandDescription}
        email={footer?.email}
        phone={footer?.phone}
        instagramUrl={footer?.instagramUrl}
        whatsappUrl={footer?.whatsappUrl}
        locale={locale}
      />
    </div>
  )
}