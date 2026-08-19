'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { Media } from '@/payload-types'

type GalleryImage = {
  image: number | Media
  id?: string | null
}

interface ProductGalleryProps {
  singleImage?: (number | null) | Media
  galleryImages?: GalleryImage[] | null
  name: string
  scientificName?: string | null
}

function getMediaUrl(img: number | Media): string | null {
  if (typeof img === 'number') return null
  return img.url || null
}

export default function ProductGallery({ singleImage, galleryImages, name, scientificName }: ProductGalleryProps) {
  const all: string[] = []

  const single = singleImage && typeof singleImage !== 'number' ? singleImage.url : null
  if (single) all.push(single)

  if (galleryImages) {
    for (const gi of galleryImages) {
      const u = getMediaUrl(gi.image)
      if (u && !all.includes(u)) all.push(u)
    }
  }

  const [selected, setSelected] = useState(0)
  const currentUrl = all[selected] || null

  // Build meaningful alt text: botanical jewellery description + product name
  const altBase = name
    ? `Joia botânica artesanal — ${name}${scientificName ? ` (${scientificName})` : ''} — Eternal Flowers. Flor natural preservada em resina.`
    : 'Joia botânica artesanal Eternal Flowers — flor natural preservada em resina.'

  if (!currentUrl) {
    return (
      <div className="relative aspect-square overflow-hidden bg-brand-cream">
        <Image
          src="/hero-fallback.png"
          alt={altBase}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="relative aspect-square overflow-hidden bg-brand-cream">
        {all.map((url, i) => (
          <div
            key={url}
            aria-hidden={i !== selected}
            className={`absolute inset-0 transition-opacity duration-500 ${
              i === selected ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <Image
              src={url}
              alt={i === selected ? altBase : ''}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {all.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {all.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`${name} — ${i + 1}`}
              aria-pressed={i === selected}
              className={`relative h-20 w-20 shrink-0 overflow-hidden border transition-all duration-500 ${
                i === selected
                  ? 'border-brand-gold/30 opacity-100'
                  : 'border-brand-wood/10 opacity-60 hover:border-brand-gold/30 hover:opacity-100'
              }`}
            >
              <Image
                src={url}
                alt={`${altBase} — foto ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}