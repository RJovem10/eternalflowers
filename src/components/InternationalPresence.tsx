import Section from './Section'

interface InternationalPresenceProps {
  title: string
  subtitle?: string | null
}

export default function InternationalPresence({ title, subtitle }: InternationalPresenceProps) {
  const locations = [
    { country: 'Portugal', flags: '🇵🇹', cities: 'Braga · Lisboa' },
    { country: 'Espanha', flags: '🇪🇸', cities: 'Exposições' },
    { country: 'Itália', flags: '🇮🇹', cities: 'Trento · Mati' },
  ]

  return (
    <Section title={title} subtitle={subtitle || undefined} align="center" background="bg-stone-50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
        {locations.map((loc) => (
          <div
            key={loc.country}
            className="text-center p-6 rounded-xl bg-white border border-stone-200"
          >
            <span className="text-4xl">{loc.flags}</span>
            <h3 className="text-lg font-medium text-stone-800 mt-3">{loc.country}</h3>
            <p className="text-sm text-stone-500 mt-1">{loc.cities}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}