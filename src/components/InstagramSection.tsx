import Section from './Section'
import ReelsGrid from './ReelsGrid'
import type { IgReel } from '@/services/instagram'

interface InstagramSectionProps {
  title: string
  handle: string
  text?: string | null
  dict: any
  reels?: IgReel[]
}

function safeHandle(h: string | undefined | null): string {
  if (!h || h === 'undefined' || h === 'null') return 'eternal.flowers.pt'
  return h
}

export default function InstagramSection({ title, handle, text, reels }: InstagramSectionProps) {
  const cleanHandle = safeHandle(handle)
  const hasReels = reels && reels.length > 0

  return (
    <Section
      title={title}
      align="center"
      background="bg-white"
      size="compact"
    >
      {hasReels ? (
        <div className="space-y-6">
          <ReelsGrid reels={reels} handle={cleanHandle} />
          <div className="text-center">
            <a
              href={`https://www.instagram.com/${cleanHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-brand-gold/60 hover:text-brand-gold transition-colors duration-300 font-body font-medium"
            >
              @{cleanHandle} →
            </a>
          </div>
        </div>
      ) : (
        /* Fallback actual — link simples para o perfil Instagram */
        <div className="max-w-md mx-auto text-center">
          <a
            href={`https://www.instagram.com/${cleanHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex flex-col items-center gap-4"
          >
            {/* Círculo com gradiente — como o logótipo do Instagram mas em tons da marca */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-gold/30 via-brand-blush/30 to-brand-lavender/30 flex items-center justify-center border border-brand-wood/10 group-hover:border-brand-gold/30 transition-all duration-500">
              <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300">📸</span>
            </div>
            <p className="font-body text-base text-brand-charcoal/55 leading-relaxed font-light">
              {text}
            </p>
            <span className="text-[11px] uppercase tracking-[0.25em] text-brand-gold/60 group-hover:text-brand-gold transition-colors duration-300 font-body font-medium">
              @{cleanHandle} →
            </span>
          </a>
        </div>
      )}
    </Section>
  )
}