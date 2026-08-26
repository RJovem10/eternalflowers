import Image from 'next/image'
import Link from 'next/link'
import Section from './Section'

interface FlowerData {
  name: string
  scientificName: string
  image?: { url?: string | null } | number | null
}

interface RealFlowersProps {
  title: string
  subtitle?: string | null
  flowers?: FlowerData[] | null
  dict: any
  locale?: string
}

interface DisplayFlower {
  name: string
  species: string
  image: string
}

const fallbackFlowers: DisplayFlower[] = [
  { name: 'Orquídea Vanda', species: 'Vanda coerulea', image: '/instagram/3893196693588849020.jpg' },
  { name: 'Paphiopedilum', species: 'Paphiopedilum Pinocchio', image: '/instagram/3874976971600823469.jpg' },
  { name: 'Sobrália', species: 'Sobralia rosea', image: '/instagram/3907793258139193626.jpg' },
  { name: 'Cambria', species: 'Cambria Africana', image: '/instagram/3914898543066761710.jpg' },
  { name: 'Laelia', species: 'Laelia purpurata', image: '/instagram/3920110427486042976.jpg' },
  { name: 'Cattleya', species: 'Cattleya spp.', image: '/instagram/3949769286870927720.jpg' },
]

// Build a lookup from scientificName → legacy image for hybrid fallback
const fallbackBySpecies = new Map<string, string>(
  fallbackFlowers.map(f => [f.species, f.image]),
)

const landingSlug: Record<string, string> = {
  pt: 'joias-botanicas',
  en: 'botanical-jewellery',
  es: 'joyeria-botanica',
  it: 'gioielli-botanici',
  de: 'botanischer-schmuck',
}

const linkLabel: Record<string, string> = {
  pt: 'Saber mais sobre joias botânicas →',
  en: 'Learn more about botanical jewellery →',
  es: 'Saber más sobre joyería botánica →',
  it: 'Scopri di più sui gioielli botanici →',
  de: 'Mehr über botanischen Schmuck →',
}

// Type guard: a CMS flower is usable only when it has a `url` string on its image object.
function isCmsFlowerWithImage(f: FlowerData): f is FlowerData & { image: { url: string } } {
  const img = f.image
  return Boolean(
    img &&
      typeof img === 'object' &&
      'url' in img &&
      typeof img.url === 'string' &&
      img.url.length > 0,
  )
}

/**
 * Hybrid fallback logic:
 *
 * A. CMS array null/empty → fallbackFlowers (6 legacy)
 * B. CMS has entries:
 *    - For each CMS flower in CMS order:
 *      1. If has image.url → use Payload image
 *      2. If no image AND scientificName matches a legacy flower → use legacy image
 *      3. New flower (no legacy match) without image → skip (don't render)
 *    - Renders only resolved entries (never empty src)
 */
export default function RealFlowers({ title, subtitle, flowers, dict, locale }: RealFlowersProps) {
  const cmsFlowers = flowers || []

  let displayFlowers: DisplayFlower[]

  if (cmsFlowers.length === 0) {
    // A. No CMS data → full legacy fallback
    displayFlowers = fallbackFlowers
  } else {
    // B. CMS has entries → resolve each one
    displayFlowers = cmsFlowers
      .map((f): DisplayFlower | null => {
        if (isCmsFlowerWithImage(f)) {
          return {
            name: f.name,
            species: f.scientificName,
            image: f.image.url,
          }
        }
        // No Payload image — check if it matches a legacy flower
        const legacyImage = f.scientificName ? fallbackBySpecies.get(f.scientificName) : undefined
        if (legacyImage) {
          return {
            name: f.name,
            species: f.scientificName,
            image: legacyImage,
          }
        }
        // New flower without image → skip
        return null
      })
      .filter((f): f is DisplayFlower => f !== null)
  }

  return (
    <Section
      title={title}
      subtitle={subtitle || undefined}
      align="center"
      background="bg-white"
      size="compact"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-12">
        {displayFlowers.map((f, i) => (
          <div key={f.species || `flower-${i}`} className="group text-center">
            {/* Círculo com fotografia */}
            <div className="relative mx-auto w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden mb-4 ring-1 ring-brand-wood/10 group-hover:ring-brand-gold/30 transition-all duration-500">
              <Image
                src={f.image}
                alt={f.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="112px"
              />
            </div>
            <p className="font-display text-sm lg:text-base font-light text-brand-charcoal/80 tracking-wide">
              {f.name}
            </p>
            {f.species && (
              <p className="text-[11px] italic text-brand-charcoal/35 font-body font-light mt-0.5">
                {f.species}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Contextual internal link to botanical jewellery pillar page */}
      {locale && landingSlug[locale] && (
        <div className="mt-10 text-center">
          <Link
            href={`/${locale}/${landingSlug[locale]}`}
            className="inline-flex items-center text-xs uppercase tracking-[0.2em] text-brand-gold hover:text-brand-gold-dark transition-colors duration-300 font-body font-medium"
          >
            {linkLabel[locale] || linkLabel.pt}
          </Link>
        </div>
      )}
    </Section>
  )
}