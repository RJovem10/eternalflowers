import Section from './Section'

interface InternationalPresenceProps {
  title: string
  subtitle?: string | null
  dict: any
}

const countryFlags: Record<string, string> = {
  PT: '🇵🇹',
  ES: '🇪🇸',
  IT: '🇮🇹',
}

export default function InternationalPresence({ title, subtitle, dict }: InternationalPresenceProps) {
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
          {dict.internationalPresence.map((loc: { code: string; country: string; cities: string; description: string }) => (
            <div
              key={loc.code}
              className="flex-1 text-center p-8 lg:p-10 bg-white"
            >
              <span className="text-2xl block mb-4">{countryFlags[loc.code] || '🌍'}</span>
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