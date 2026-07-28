import AddToCartButton from './AddToCartButton'

interface CategoryRef {
  id: number
  name: string
}

interface CollectionRef {
  id: number
  name: string
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
}

const availabilityStyles: Record<string, string> = {
  available: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  reserved: 'text-amber-700 bg-amber-50 border-amber-200',
  sold: 'text-stone-500 bg-stone-100 border-stone-200',
  preparing: 'text-sky-700 bg-sky-50 border-sky-200',
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
}: ProductInfoProps) {
  const catName =
    category && typeof category !== 'number' ? category.name : null
  const colNames: string[] =
    collections
      ?.filter((c): c is CollectionRef => typeof c !== 'number')
      .map((c) => c.name) ?? []

  const soldOut = availability === 'sold'
  const availStyle = availabilityStyles[availability] || ''
  const availLabel = dict[availabilityLabels[availability]] || availability

  return (
    <div className="space-y-8">
      {/* Nome da Criação */}
      {creationName && (
        <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-stone-900 leading-tight">
          {creationName}
        </h1>
      )}

      {/* Nome Científico */}
      <div>
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
          {dict.scientificName}
        </p>
        <p className="text-lg text-stone-600 font-light italic">
          {scientificName}
        </p>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-3">
        {catName && (
          <span className="text-xs px-3 py-1.5 rounded-full border border-stone-200 text-stone-600 bg-stone-50">
            {catName}
          </span>
        )}
        {colNames.map((n) => (
          <span
            key={n}
            className="text-xs px-3 py-1.5 rounded-full border border-stone-200 text-stone-600 bg-stone-50"
          >
            {n}
          </span>
        ))}
        <span className="text-xs px-3 py-1.5 rounded-full border border-stone-200 text-stone-600 bg-stone-50">
          {dict[productTypeLabels[productType]] || productType}
        </span>
      </div>

      {/* Preço */}
      <div className="pt-4 border-t border-stone-100">
        <p className="text-3xl font-light text-stone-900">
          {price.toFixed(2)} €
        </p>
      </div>

      {/* Disponibilidade */}
      <div>
        <span className={`inline-block text-xs font-medium px-3 py-1.5 rounded-full border ${availStyle}`}>
          {availLabel}
        </span>
      </div>

      {/* Descrição curta */}
      {description && (
        <p className="text-sm text-stone-500 leading-relaxed whitespace-pre-line">
          {description}
        </p>
      )}

      {/* Botão Adicionar ao Carrinho */}
      <div className="pt-2">
        <AddToCartButton
          dict={dict}
          item={{
            id: String(flowerId),
            name: creationName || flowerName,
            price,
            image: flowerImage,
            qty: 1,
          }}
          disabled={soldOut}
        />
        {soldOut && (
          <p className="text-xs text-stone-400 mt-2">{dict.sold}</p>
        )}
      </div>
    </div>
  )
}