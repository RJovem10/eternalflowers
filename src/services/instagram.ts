/**
 * instagram.ts — Server-only service for Instagram Reels
 *
 * Fetches the 4 most recent Reels from the Eternal Flowers Instagram Business
 * account via the Instagram Basic Display API.
 *
 * Caches server-side with a 30-minute revalidation window.
 * NEVER exposes the access token to the browser.
 */
import { unstable_cache } from 'next/cache'

const API_BASE = 'https://graph.instagram.com/v26.0'
const BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID ?? ''
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN ?? ''
const REELS_CACHE_TAG = 'instagram-reels'
const MAX_REELS = 4
const CACHE_TTL = 30 * 60 // 30 minutes

export interface IgReel {
  id: string
  thumbnailUrl: string
  videoUrl: string | null
  permalink: string
  caption: string | null
  timestamp: string
}

interface IgMediaItem {
  id: string
  media_type: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink: string
  caption?: string
  timestamp: string
}

interface IgErrorResponse {
  error?: { message?: string; type?: string; code?: number }
}

/**
 * Fetch raw media from the Instagram API and return only Reels.
 * Considers media_product_type === 'REELS'.
 * Orders by timestamp descending, returns at most 4.
 */
async function fetchReelsFromApi(): Promise<IgReel[]> {
  if (!BUSINESS_ID || !ACCESS_TOKEN) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[instagram] Missing INSTAGRAM_BUSINESS_ID or INSTAGRAM_ACCESS_TOKEN')
    }
    return []
  }

  const url = `${API_BASE}/${BUSINESS_ID}/media?fields=id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp&access_token=${ACCESS_TOKEN}&limit=10`

  let response: Response
  try {
    response = await fetch(url, {
      next: { revalidate: CACHE_TTL },
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    console.error('[instagram] Network error fetching Reels:', err instanceof Error ? err.message : String(err))
    return []
  }

  if (!response.ok) {
    const body: IgErrorResponse = await response.json().catch(() => ({}))
    const msg = body?.error?.message ?? `HTTP ${response.status}`
    console.error(`[instagram] API error: ${msg}`)
    return []
  }

  let data: { data: IgMediaItem[] }
  try {
    data = await response.json()
  } catch {
    console.error('[instagram] Failed to parse API response')
    return []
  }

  if (!data?.data || !Array.isArray(data.data)) {
    console.warn('[instagram] Unexpected API response shape')
    return []
  }

  const reels = data.data
    .filter((item) => item.media_product_type === 'REELS')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_REELS)
    .map((item) => ({
      id: item.id,
      thumbnailUrl: item.thumbnail_url ?? '',
      videoUrl: item.media_url ?? null,
      permalink: item.permalink,
      caption: item.caption ?? null,
      timestamp: item.timestamp,
    }))

  return reels
}

/**
 * Cached version of fetchReelsFromApi.
 * Revalidates every 30 minutes. On API failure returns [] silently.
 */
export const getCachedReels = unstable_cache(
  async (): Promise<IgReel[]> => {
    return fetchReelsFromApi()
  },
  [REELS_CACHE_TAG],
  { revalidate: CACHE_TTL, tags: [REELS_CACHE_TAG] },
)