import Link from 'next/link'
import AddToCartButton from './AddToCartButton'
import { computePurchaseEligibility } from '@/lib/can-purchase'

interface CategoryRef {
  id: number
  name: string
  slug: string
}

interface CollectionRef {
  id: number
  name: string
  slug: string
  isActive?: boolean
}

interface ProductInfoProps {
  creationName?: string | null
  scientificName: string
  category?: (number | null) | CategoryRef
  collections?: (number | CollectionRef)[] | null
  productType: string
  price: number
  availability: string
  description?: string | null
  dict: any
  locale: string
  flowerId: string
  flowerName: string
  flowerImage?: string | null
  productionMode?: string | null
  stockQuantity?: number | null
  productionLeadTime?: number | null
}

const availabilityStyles: Record<string, string> = {
  available: 'bg-brand-sage/10 text-brand-sage',
  reserved: 'bg-brand-blush/10 text-brand-blush',
  sold: 'bg-brand-charcoal/10 text-brand-charcoal/40',
  preparing: 'bg-brand-lavender/10 text-brand-lavender',
}

const availabilityLabels: Record<string, string> = {
  available: 'available',
  reserved: 'reserved',
  sold: 'sold',
  preparing: 'preparing',
}

const productTypeLabels: Record<string, string> = {
  permanente: 'productTypePermanente',
  sazonal: 'productTypeSazonal',
  exclusivo: 'productTypeExclusivo',
}

export default function ProductInfo({
  creationName,
  scientificName,
  category,
  collections,
  productType,
  price,
  availability,
  description,
  dict,
  locale,
  flowerId,
  flowerName,
  flowerImage,
  productionMode,
  stockQuantity,
  productionLeadTime,
}: ProductInfoProps) {
  const catName =
    category && typeof category !== 'number' ? category.name : null
  const catSlug =
    category && typeof category !== 'number' ? category.slug : null
  const colRefs: { name: string; slug: string }[] =
    collections
      ?.filter((c): c is CollectionRef => typeof c !== 'number')
      .filter((c) => c.isActive !== false) // only active collections get a public link
      .map((c) => ({ name: c.name, slug: c.slug })) ?? []

  // Determinar se o produto é comprável (delega no helper partilhado para consistência com JSON-LD)
  const { canPurchase: canAddToCart } = computePurchaseEligibility({
    availability,
    productionMode,
    stockQuantity,
  })

  // Prazo de produção (só made_to_order)
  const showLeadTime = productionMode === 'made_to_order' && productionLeadTime != null && productionLeadTime > 0
  const availStyle = availabilityStyles[availability] || ''
  const availLabel = dict[availabilityLabels[availability]] || availability

  return (
    <div className="flex h-full flex-col">
      <div>
        <h1 className="font-display text-3xl font-light text-brand-charcoal lg:text-4xl">
          {creationName || flowerName}
        </h1>
        <p className="mt-3 font-body text-base italic text-brand-charcoal/50">
          {scientificName}
        </p>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {catName && catSlug && (
          <Link
            href={`/${locale}/category/${catSlug}`}
            className="border border-brand-wood/10 bg-brand-wood/5 px-3 py-1.5 text-xs text-brand-wood transition-colors duration-300 hover:border-brand-gold/30 hover:text-brand-gold-dark"
          >
            {catName}
          </Link>
        )}
        {colRefs.map((c) => (
          <Link
            key={c.slug}
            href={`/${locale}/collection/${c.slug}`}
            className="border border-brand-wood/10 bg-brand-wood/5 px-3 py-1.5 text-xs text-brand-wood transition-colors duration-300 hover:border-brand-gold/30 hover:text-brand-gold-dark"
          >
            {c.name}
          </Link>
        ))}
        <span className="border border-brand-wood/10 bg-brand-wood/5 px-3 py-1.5 text-xs text-brand-wood">
          {dict[productTypeLabels[productType]] || productType}
        </span>
      </div>

      <div className="mt-10 border-t border-brand-wood/10 pt-8">
        <p className="font-display text-3xl text-brand-charcoal">
          {price.toFixed(2)} €
        </p>
      </div>

      <div className="mt-5">
        <span className={`inline-block px-3 py-1.5 text-xs font-medium ${availStyle}`}>
          {availLabel}
        </span>
      </div>

      {description && (
        <p className="mt-9 whitespace-pre-line font-body text-brand-charcoal/60">
          {description}
        </p>
      )}

      <div className="mt-10">
        <AddToCartButton
          dict={dict}
          item={{
            id: String(flowerId),
            name: creationName || flowerName,
            price,
            image: flowerImage,
            qty: 1,
          }}
          disabled={!canAddToCart}
        />
        {!canAddToCart && (
          <p className="mt-3 text-sm leading-relaxed text-brand-charcoal/60">
            {availLabel}
          </p>
        )}
        {showLeadTime && (
          <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/50">
            {(productionLeadTime === 1
              ? dict.leadTimeSingular
              : dict.leadTimePlural
            )?.replace('{days}', String(productionLeadTime))}
          </p>
        )}
      </div>
    </div>
  )
}