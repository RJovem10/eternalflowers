import Section from './Section'

interface RealFlowersProps {
  title: string
  subtitle?: string | null
}

export default function RealFlowers({ title, subtitle }: RealFlowersProps) {
  const flowers = [
    { name: 'Orquídea Vanda', color: 'from-purple-300 to-pink-200' },
    { name: 'Paphiopedilum', color: 'from-amber-300 to-yellow-200' },
    { name: 'Sobrália', color: 'from-pink-300 to-rose-200' },
    { name: 'Cambria', color: 'from-orange-300 to-amber-200' },
    { name: 'Orquídea Phalaenopsis', color: 'from-white to-stone-200' },
    { name: 'Laelia', color: 'from-fuchsia-300 to-purple-200' },
  ]

  return (
    <Section title={title} subtitle={subtitle || undefined} align="center">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {flowers.map((f) => (
          <div key={f.name} className="group text-center">
            <div
              className={`aspect-square rounded-2xl bg-gradient-to-br ${f.color} mb-3 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-shadow`}
            >
              <span className="text-4xl opacity-50">🌺</span>
            </div>
            <p className="text-sm text-stone-600 font-medium">{f.name}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}