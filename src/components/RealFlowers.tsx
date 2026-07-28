import Image from 'next/image'
import Section from './Section'

interface RealFlowersProps {
  title: string
  subtitle?: string | null
}

const flowers = [
  { name: 'Orquídea Vanda', species: 'Vanda coerulea', color: 'from-[#7B5EA7] to-[#C9B1D0]', emoji: '💜', image: '/instagram/3893196693588849020.jpg' },
  { name: 'Paphiopedilum', species: 'Paphiopedilum Pinocchio', color: 'from-[#8B7355] to-[#C5D0BE]', emoji: '🤎', image: '/instagram/3874976971600823469.jpg' },
  { name: 'Sobrália', species: 'Sobralia rosea', color: 'from-[#E8B4B8] to-[#F5D0D4]', emoji: '🩷', image: '/instagram/3907793258139193626.jpg' },
  { name: 'Cambria', species: 'Cambria Africana', color: 'from-[#C97B6B] to-[#E8C5B8]', emoji: '🧡', image: '/instagram/3914898543066761710.jpg' },
  { name: 'Laelia', species: 'Laelia purpurata', color: 'from-[#D4A853] to-[#E8D5A3]', emoji: '💛', image: '/instagram/3920110427486042976.jpg' },
  { name: 'Cattleya', species: 'Cattleya spp.', color: 'from-[#E8B4B8] to-[#C9B1D0]', emoji: '🩷', image: '/instagram/3949769286870927720.jpg' },
]

export default function RealFlowers({ title, subtitle }: RealFlowersProps) {
  return (
    <Section
      title={title}
      subtitle={subtitle || undefined}
      align="center"
      background="bg-white"
      size="compact"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-12">
        {flowers.map((f, i) => (
          <div key={f.name} className="group text-center">
            {/* Círculo com fotografia real do Instagram */}
            <div className="relative mx-auto w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden mb-4 ring-1 ring-brand-wood/10 group-hover:ring-brand-gold/30 transition-all duration-500">
              <Image
                src={f.image}
                alt={f.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="112px"
              />
              {/* Overlay gradiente para dar profundidade */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-10 group-hover:opacity-0 transition-opacity duration-500`} />
            </div>
            <p className="font-display text-sm lg:text-base font-light text-brand-charcoal/80 tracking-wide">
              {f.name}
            </p>
            <p className="text-[11px] italic text-brand-charcoal/35 font-body font-light mt-0.5">
              {f.species}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}