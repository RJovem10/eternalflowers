'use client'

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
}

function getMediaUrl(img: number | Media): string | null {
  if (typeof img === 'number') return null
  return img.url || null
}

export default function ProductGallery({ singleImage, galleryImages, name }: ProductGalleryProps) {
  // Merge single image + gallery into one array
  const all: string[] = []

  const single = singleImage && typeof singleImage !== 'number' ? singleImage.url : null
  if (single) all.push(single)

  if (galleryImages) {
    for (const gi of galleryImages) {
      const u = getMediaUrl(gi.image)
      if (u) all.push(u)
    }
  }

  const [selected, setSelected] = useState(0)
  const currentUrl = all[selected] || null

  if (!currentUrl) {
    return (
      <div className="aspect-square bg-stone-100 rounded-3xl flex items-center justify-center">
        <span className="text-6xl">🌷</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="aspect-square bg-stone-50 rounded-3xl overflow-hidden">
        {/* @ts-ignore */}
        <img
          src={currentUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnails — only show when there are multiple images */}
      {all.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {all.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                i === selected
                  ? 'border-stone-900 opacity-100'
                  : 'border-stone-200 opacity-60 hover:opacity-100 hover:border-stone-400'
              }`}
            >
              {/* @ts-ignore */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}