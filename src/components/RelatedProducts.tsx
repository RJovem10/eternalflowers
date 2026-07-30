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
    <section>
      <h2 className="mb-10 font-display text-3xl font-light tracking-tight text-brand-charcoal sm:text-4xl">
        {dict.relatedProducts}
      </h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
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
    </section>
  )
}
