import Link from 'next/link'

export type FlowerCardData = {
  id: string
  name: string
  price: number
  image?: string | null
  availability: string
  locale: string
}

export default function FlowerCard({ flower, dict }: { flower: FlowerCardData; dict: any }) {
  const badge = () => {
    switch (flower.availability) {
      case 'sold': return <span className="bg-stone-700 text-white text-xs px-2 py-1 rounded">{dict.sold}</span>
      case 'reserved': return <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded">{dict.reserved}</span>
      case 'preparing': return <span className="bg-sky-600 text-white text-xs px-2 py-1 rounded">{dict.preparing}</span>
      default: return null
    }
  }

  const soldOut = flower.availability === 'sold'

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition">
      <Link href={`/${flower.locale}/flower/${flower.id}`}>
        <div className="aspect-square bg-stone-100 relative">
          {flower.image ? (
            // @ts-ignore
            <img src={flower.image} alt={flower.name} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🌷</div>
          )}
          <div className="absolute top-2 left-2">{badge()}</div>
        </div>
      </Link>
      <div className="p-4">
        <h3 className="font-medium truncate">{flower.name}</h3>
        <p className="text-rose-700 font-semibold mt-1">{flower.price.toFixed(2)} €</p>
        <Link
          href={`/${flower.locale}/flower/${flower.id}`}
          className="mt-3 inline-block text-sm text-stone-600 hover:underline"
        >
          {dict.viewDetails}
        </Link>
      </div>
    </div>
  )
}
