import FlowerCard from './FlowerCard'

interface RelatedProductData {
  id: number
  name: string
  price: number
  image?: string | null
  availability: string
  locale: string
  creationName?: string | null
  scientificName: string
}

interface RelatedProductsProps {
  products: RelatedProductData[]
  dict: any
  locale: string
}

export default function RelatedProducts({ products, dict, locale }: RelatedProductsProps) {
  if (products.length === 0) return null

  return (
    <div>
      <h2 className="text-xl font-light text-stone-900 mb-8 tracking-tight">
        {dict.relatedProducts}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {products.map((p) => (
          <FlowerCard
            key={p.id}
            flower={{
              id: String(p.id),
              name: p.creationName || p.scientificName || p.name,
              price: p.price,
              image: p.image,
              availability: p.availability,
              locale,
            }}
            dict={dict}
          />
        ))}
      </div>
    </div>
  )
}