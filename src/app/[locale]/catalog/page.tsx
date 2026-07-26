import { getDictionary } from '@/i18n/dictionaries'
import FlowerCard from '@/components/FlowerCard'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function Catalog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale)
  const payload = await getPayload({ config })

  const flowers = await payload.find({ collection: 'flowers', limit: 200, sort: '-createdAt' })

  const nf = ({ pt: 'namePt', en: 'nameEn', es: 'nameEs', it: 'nameIt', de: 'nameDe' }[locale] || 'namePt')

  const cards = flowers.docs.map((f: any) => ({
    id: f.id,
    name: f[nf] || f.namePt || '—',
    price: f.price,
    image: f.image?.url || null,
    availability: f.availability || 'available',
    locale,
  }))

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{dict.catalog}</h1>
      {cards.length === 0 ? (
        <p className="text-stone-500">—</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <FlowerCard key={c.id} flower={c} dict={dict} />
          ))}
        </div>
      )}
    </div>
  )
}
