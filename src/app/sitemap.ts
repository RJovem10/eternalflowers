import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { locales } from '@/i18n/dictionaries'

export const dynamic = 'force-dynamic'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  'https://eternalflowers.pt'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  // ── Static public routes per locale ──────────────────────
  // No invented lastModified — omit the field entirely.
  const staticRoutes = ['', '/catalog', '/about']

  for (const locale of locales) {
    for (const route of staticRoutes) {
      entries.push({
        url: `${siteUrl}/${locale}${route}`,
        changeFrequency: route === '' ? 'weekly' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
    }
  }

  // ── Product pages from Payload ───────────────────────────
  try {
    const payload = await getPayload({ config })

    const flowers = await payload.find({
      collection: 'flowers',
      limit: 500,
      depth: 0,
      pagination: false,
    })

    for (const flower of flowers.docs) {
      const entry: MetadataRoute.Sitemap[number] = {
        url: `${siteUrl}/pt/flower/${flower.id}`,
        changeFrequency: 'monthly',
        priority: 0.6,
      }

      // Only include lastModified if a real meaningful timestamp exists
      if (flower.updatedAt) {
        entry.lastModified = new Date(flower.updatedAt)
      }

      // Generate one entry per locale (same canonical content, different language)
      // hreflang is handled by the page-level metadata, not the sitemap
      for (const locale of locales) {
        const localizedEntry = { ...entry, url: `${siteUrl}/${locale}/flower/${flower.id}` }
        entries.push(localizedEntry)
      }
    }
  } catch {
    // Sitemap is generated per-request (force-dynamic), so this is transient.
    // If Payload is temporarily unreachable, the sitemap will retry on next request.
    // warn only — do not silently freeze an empty product list.
    console.warn('[sitemap] Payload unavailable — returning static entries only. Will retry on next request.')
  }

  return entries
}