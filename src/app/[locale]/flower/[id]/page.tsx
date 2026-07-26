import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/i18n/dictionaries'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'
import AddToCartButton from '@/components/AddToCartButton'

export default async function FlowerDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const dict = getDictionary(locale)
  const payload = await getPayload({ config })
  let flower
  try {
    flower = await payload.findByID({ collection: 'flowers', id })
  } catch {
    notFound()
  }
  if (!flower) notFound()

  const nf = ({ pt: 'namePt', en: 'nameEn', es: 'nameEs', it: 'nameIt', de: 'nameDe' }[locale] || 'namePt')
  const df = ({ pt: 'descriptionPt', en: 'descriptionEn', es: 'descriptionEs', it: 'descriptionIt', de: 'descriptionDe' }[locale] || 'descriptionPt')
  const f: any = flower
  const name = f[nf] || f.namePt || '—'
  const description = f[df] || ''
  const image = f.image?.url
  const avail = f.availability || 'available'
  const sku = f.sku

  const availabilityLabel: any = {
    available: dict.available,
    reserved: dict.reserved,
    sold: dict.sold,
    preparing: dict.preparing,
  }
  const soldOut = avail === 'sold'

  return (
    <div>
      <Link href={`/${locale}/catalog`} className="text-sm text-stone-500 hover:underline">
        ← {dict.backToCatalog}
      </Link>
      <div className="grid md:grid-cols-2 gap-8 mt-6">
        <div className="aspect-square bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center">
          {image ? (
            // @ts-ignore
            <img src={image} alt={name} className="object-cover w-full h-full" />
          ) : (
            <span className="text-7xl">🌷</span>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{name}</h1>
          {sku && <p className="text-stone-400 text-sm mt-1">{sku}</p>}
          <p className="text-2xl text-rose-700 font-semibold mt-3">{f.price.toFixed(2)} €</p>
          <p className="mt-2">
            <span className={
              avail === 'sold' ? 'bg-stone-700 text-white px-2 py-1 rounded text-sm'
                : avail === 'reserved' ? 'bg-amber-600 text-white px-2 py-1 rounded text-sm'
                : avail === 'preparing' ? 'bg-sky-600 text-white px-2 py-1 rounded text-sm'
                : 'bg-emerald-600 text-white px-2 py-1 rounded text-sm'
            }>
              {availabilityLabel[avail]}
            </span>
          </p>
          {description && <p className="text-stone-700 mt-4 whitespace-pre-line">{description}</p>}
          <div className="mt-6">
            <AddToCartButton
              dict={dict}
              item={{ id: String(f.id), name, price: f.price, image, qty: 1 }}
              disabled={soldOut}
            />
            {soldOut && <p className="text-stone-400 text-sm mt-2">{dict.sold}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
