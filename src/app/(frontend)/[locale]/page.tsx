import { getPayloadClient } from '@/payload'
import { getDictionary } from '@/i18n/dictionaries'
import Hero from '@/components/FounderHero'
import RealFlowers from '@/components/RealFlowers'
import CategoriesSection from '@/components/CategoriesSection'
import CollectionsSection from '@/components/CollectionsSection'
import StorySection from '@/components/StorySection'
import MarinaPicks from '@/components/MarinaPicks'
import InternationalPresence from '@/components/InternationalPresence'
import InstagramSection from '@/components/InstagramSection'
import CTAFinal from '@/components/CTAFinal'
import Footer from '@/components/Footer'

/**
 * A homepage da Eternal Flowers segue um arco narrativo em 7 atos:
 *
 *   ATO 1 — HERÓI  (Hero)
 *   O visitante chega. O impacto é imediato. A imagem domina.
 *   A pergunta "O que é isto?" é respondida em segundos.
 *
 *   ATO 2 — VERDADE (RealFlowers)
 *   "São flores verdadeiras."  Nomes científicos. Autenticidade.
 *
 *   ATO 3 — UTILIDADE (CategoriesSection)
 *   "O que posso comprar?"  Navegação por tipo de peça.
 *
 *   ATO 4 — EDIÇÃO (CollectionsSection)
 *   "O que é especial?"  Coleções temáticas, imagens grandes.
 *
 *   ATO 5 — ALMA (StorySection + MarinaPicks)
 *   "Porque é que isto existe?"  A história da Marina e as suas escolhas.
 *
 *   ATO 6 — CREDIBILIDADE (InternationalPresence + InstagramSection)
 *   "Isto é a sério."  Prova social, presença global, comunidade.
 *
 *   ATO 7 — FECHO (CTAFinal)
 *   "E agora?"  O convite final para eternizar uma memória.
 */

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
    payload.find({ collection: 'flowers', limit: 8, sort: '-createdAt', depth: 1 }),
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
    <div className="-mt-16 lg:-mt-20">
      {/* ─── ATO 1: HERÓI — A MARINA ─── */}
      <Hero
        heroTitle={hero.heroTitle || 'Joias Botânicas\nFeitas à Mão'}
        heroSubtitle={hero.heroSubtitle || 'Cada peça é uma história que o tempo não apaga. Flores verdadeiras, eternizadas em resina pela Marina, em Braga.'}
        locale={locale}
        dict={dict}
      />

      {/* ─── ATO 2: VERDADE ─── */}
      {/* Background: branco | Size: compact | Prova botânica */}
      <RealFlowers
        title={realFlowers?.title || dict.realFlowersTitle}
        subtitle={realFlowers?.subtitle}
        dict={dict}
      />

      {/* ─── ATO 3: UTILIDADE ─── */}
      {/* Background: creme | Size: default | Grid de categorias */}
      <CategoriesSection
        categories={categoriesData.docs.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
        }))}
        locale={locale}
        dict={dict}
      />

      {/* ─── ATO 4: EDIÇÃO ─── */}
      {/* Background: branco | Size: default | Imagens grandes, editorial */}
      <CollectionsSection
        collections={collectionsData.docs.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: c.image,
        }))}
        locale={locale}
        dict={dict}
      />

      {/* ─── ATO 5: ALMA ─── */}
      {/* Background: creme | Size: large | Split layout, história */}
      <StorySection
        title={story?.title || dict.storyTitleFallback}
        text={story?.text || dict.storyTextFallback}
        image={story?.image}
        dict={dict}
      />

      {/* Background: branco | Size: default | Escolhas curadas */}
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

      {/* ─── ATO 6: CREDIBILIDADE ─── */}
      {/* Background: creme | Size: default | Prova social */}
      <InternationalPresence
        title={international?.title || dict.internationalTitle}
        subtitle={international?.subtitle}
        dict={dict}
      />

      {/* Background: branco | Size: compact | Comunidade */}
      <InstagramSection
        title={instagram?.title || dict.instagramTitle}
        handle={instagram?.handle || 'eternal.flowers.pt'}
        text={instagram?.text || dict.instagramText}
        dict={dict}
      />

      {/* ─── ATO 7: FECHO ─── */}
      {/* Background: escuro | Size: grande | O convite emocional */}
      <CTAFinal
        title={cta?.title || dict.ctaTitleFallback}
        subtitle={cta?.subtitle}
        buttonText={cta?.buttonText || dict.ctaButtonText}
        buttonLink={cta?.buttonLink || '/catalog'}
        locale={locale}
        dict={dict}
      />

      {/* Footer */}
      <Footer
        brandDescription={footer?.brandDescription}
        email={footer?.email}
        phone={footer?.phone}
        instagramUrl={footer?.instagramUrl}
        whatsappUrl={footer?.whatsappUrl}
        locale={locale}
        dict={dict}
      />
    </div>
  )
}