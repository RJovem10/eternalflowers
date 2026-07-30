import Image from 'next/image'
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
      case 'sold': return <span className="bg-brand-charcoal px-2.5 py-1.5 text-[0.65rem] uppercase tracking-wider text-brand-cream">{dict.sold}</span>
      case 'reserved': return <span className="bg-brand-gold px-2.5 py-1.5 text-[0.65rem] uppercase tracking-wider text-brand-charcoal">{dict.reserved}</span>
      case 'preparing': return <span className="bg-brand-lavender px-2.5 py-1.5 text-[0.65rem] uppercase tracking-wider text-brand-charcoal">{dict.preparing}</span>
      default: return null
    }
  }

  const displayName = flower.name || '—'
  const imgSrc = flower.image || '/hero-fallback.png'

  return (
    <article className="group overflow-hidden border border-brand-wood/10 bg-brand-cream transition-colors duration-300 hover:border-brand-gold/30">
      <Link href={`/${flower.locale}/flower/${flower.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-brand-gold/20">
          {imgSrc.startsWith('/') ? (
              <Image
                src={imgSrc}
                alt={displayName}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
          ) : (
            // External image hosts are dynamic, so they cannot be safely passed to
            // next/image without broadening the application's remote image policy.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt={displayName} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          )}
          <div className="absolute left-3 top-3">{badge()}</div>
        </div>
      </Link>
      <div className="border-t border-brand-wood/10 py-5">
        <h3 className="truncate font-display text-lg font-light text-brand-charcoal">{displayName}</h3>
        <p className="mt-1 text-sm font-medium text-brand-gold-dark">{flower.price.toFixed(2)} €</p>
        <Link
          href={`/${flower.locale}/flower/${flower.id}`}
          className="mt-4 inline-block border-b border-brand-gold/50 pb-1 text-xs uppercase tracking-[0.16em] text-brand-charcoal/65 transition-colors duration-300 hover:border-brand-gold-dark hover:text-brand-charcoal"
        >
          {dict.viewDetails}
        </Link>
      </div>
    </article>
  )
}
