import Section from './Section'

interface InstagramSectionProps {
  title: string
  handle: string
  text?: string | null
}

export default function InstagramSection({ title, handle, text }: InstagramSectionProps) {
  return (
    <Section title={title} align="center">
      <div className="max-w-lg mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-pink-400 flex items-center justify-center mb-4">
          <span className="text-2xl">📸</span>
        </div>
        <p className="text-stone-600 leading-relaxed">{text}</p>
        <a
          href={`https://www.instagram.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium transition-colors"
        >
          @{handle} →
        </a>
      </div>
    </Section>
  )
}