import Image from 'next/image'
import Section from './Section'
import type { Media } from '@/payload-types'

interface StoryProps {
  title: string
  text: string
  image?: (number | null) | Media
}

export default function StorySection({ title, text, image }: StoryProps) {
  const img = image && typeof image !== 'number' ? image : null

  return (
    <Section background="bg-stone-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Image */}
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-200 order-2 lg:order-1">
          {img?.url ? (
            <Image
              src={img.url}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100">
              <span className="text-7xl opacity-30">🌺</span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="order-1 lg:order-2">
          <h2 className="text-3xl lg:text-4xl font-light tracking-tight text-stone-900">
            {title}
          </h2>
          <div className="mt-6 w-16 h-0.5 bg-amber-300" />
          <p className="mt-6 text-base lg:text-lg text-stone-600 leading-relaxed whitespace-pre-line">
            {text}
          </p>
        </div>
      </div>
    </Section>
  )
}