'use client'

import { useState, useCallback, useRef } from 'react'
import type { IgReel } from '@/services/instagram'

interface ReelsGridProps {
  reels: IgReel[]
  handle: string
}

/**
 * ReelsGrid — Client component for interactive Instagram Reels playback.
 *
 * Behaviour:
 * - Shows thumbnail + play button initially
 * - Single click loads & plays the video inline
 * - Only ONE reel plays at a time (clicking another stops the first)
 * - onEnded → resets to thumbnail
 * - "Ver no Instagram" link always visible
 * - Responsive grid: 4 cols → 2 cols → 1 col
 */
export default function ReelsGrid({ reels, handle }: ReelsGridProps) {
  const [activeReelId, setActiveReelId] = useState<string | null>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  const handlePlay = useCallback(
    (reelId: string) => {
      // Stop currently playing reel
      if (activeReelId && activeReelId !== reelId) {
        const prevVideo = videoRefs.current.get(activeReelId)
        if (prevVideo) {
          prevVideo.pause()
          prevVideo.currentTime = 0
          prevVideo.removeAttribute('src')
          prevVideo.load()
        }
        videoRefs.current.delete(activeReelId)
      }
      setActiveReelId(reelId)
    },
    [activeReelId],
  )

  const handleEnded = useCallback((reelId: string) => {
    const video = videoRefs.current.get(reelId)
    if (video) {
      video.currentTime = 0
      video.removeAttribute('src')
      video.load()
    }
    videoRefs.current.delete(reelId)
    setActiveReelId(null)
  }, [])

  const handleError = useCallback((reelId: string) => {
    // On error, just reset to thumbnail
    const video = videoRefs.current.get(reelId)
    if (video) {
      video.currentTime = 0
      video.removeAttribute('src')
      video.load()
    }
    videoRefs.current.delete(reelId)
    setActiveReelId(null)
  }, [])

  const setVideoRef = useCallback(
    (reelId: string, el: HTMLVideoElement | null) => {
      if (el) {
        videoRefs.current.set(reelId, el)
      } else {
        videoRefs.current.delete(reelId)
      }
    },
    [],
  )

  if (!reels || reels.length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
      {reels.map((reel) => (
        <div key={reel.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-brand-cream/30">
          {activeReelId === reel.id ? (
            <video
              ref={(el) => setVideoRef(reel.id, el)}
              src={reel.videoUrl ?? undefined}
              className="absolute inset-0 w-full h-full object-cover"
              controls
              playsInline
              autoPlay
              loop={false}
              preload="metadata"
              onEnded={() => handleEnded(reel.id)}
              onError={() => handleError(reel.id)}
              aria-label={`Instagram Reel: ${reel.caption ?? 'Eternal Flowers'}`}
            />
          ) : (
            <>
              {/* Thumbnail */}
              <img
                src={reel.thumbnailUrl}
                alt={reel.caption ?? `Instagram Reel by @${handle}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              {/* Play button overlay */}
              <button
                type="button"
                onClick={() => handlePlay(reel.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors duration-300 group cursor-pointer"
                aria-label={`Reproduzir Reel: ${reel.caption?.slice(0, 60) ?? 'Eternal Flowers'}`}
              >
                <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-md group-hover:bg-white group-hover:scale-105 transition-all duration-300">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 lg:w-6 lg:h-6 text-brand-charcoal ml-0.5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </button>
            </>
          )}

          {/* "Ver no Instagram" — always visible */}
          <a
            href={reel.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 text-[10px] uppercase tracking-[0.15em] text-white/80 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm px-2 py-1 rounded transition-all duration-300"
            aria-label="Ver no Instagram (abre nova janela)"
          >
            IG →
          </a>
        </div>
      ))}
    </div>
  )
}