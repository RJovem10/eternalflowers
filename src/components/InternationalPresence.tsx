import Section from './Section'

interface InternationalPresenceProps {
  title: string
  subtitle?: string | null
}

const locations = [
  { country: 'Portugal', cities: 'Braga · Lisboa', emoji: '🇵🇹', description: 'Atelier e loja física' },
  { country: 'Espanha', cities: 'Exposições', emoji: '🇪🇸', description: 'Feiras de orquídeas' },
  { country: 'Itália', cities: 'Trento · Mati', emoji: '🇮🇹', description: 'Exposições internacionais' },
]

export default function InternationalPresence({ title, subtitle }: InternationalPresenceProps) {
  return (
    <Section
      title={title}
      subtitle={subtitle || undefined}
      align="center"
      background="bg-brand-cream"
      size="default"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col md:flex-row gap-px bg-brand-wood/8">
          {locations.map((loc) => (
            <div
              key={loc.country}
              className="flex-1 text-center p-8 lg:p-10 bg-white"
            >
              <span className="text-2xl block mb-4">{loc.emoji}</span>
              <h3 className="font-display text-lg font-light text-brand-charcoal">
                {loc.country}
              </h3>
              <p className="font-body text-sm text-brand-charcoal/50 mt-1.5 font-light">
                {loc.cities}
              </p>
              <p className="font-body text-[10px] text-brand-charcoal/35 mt-3 uppercase tracking-[0.15em]">
                {loc.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}