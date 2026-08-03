import Image from 'next/image'
import Section from './Section'
import type { Media } from '@/payload-types'

interface StoryProps {
  title: string
  text: string
  image?: (number | null) | Media
  dict: any
}

export default function StorySection({ title, text, image, dict }: StoryProps) {
  const img = image && typeof image !== 'number' ? image : null

  return (
    <Section background="bg-brand-cream" size="large">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Imagem — grande, dramática, como um editorial de revista */}
        <div className="relative aspect-[3/4] lg:aspect-[4/5] overflow-hidden bg-brand-charcoal/5 order-2 lg:order-1">
          {img?.url ? (
            <Image
              src={img.url}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-cream to-white">
              <Image
                src="/instagram/3794665544277235755.jpg"
                alt="Joias botânicas Eternal Flowers em exposição"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          )}
        </div>

        {/* Texto — íntimo, generoso no espaçamento */}
        <div className="order-1 lg:order-2 max-w-md mx-auto lg:mx-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/60 font-body font-medium mb-4">
            O Processo
          </p>
          <h2 className="font-display text-3xl lg:text-[2.5rem] font-light leading-tight tracking-tight text-brand-charcoal">
            {title}
          </h2>
          <div className="mt-5 lg:mt-6 w-12 h-[1px] bg-brand-gold/60" />
          <div className="mt-6 lg:mt-8 space-y-4">
            {text.split('\n\n').map((paragraph: string, i: number) => (
              <p
                key={i}
                className="text-base lg:text-lg text-brand-charcoal/60 leading-[1.8] font-body font-light"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}