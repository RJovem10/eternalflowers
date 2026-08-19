import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { locales, defaultLocale } from '@/i18n/dictionaries'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  'https://eternalflowers.pt'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  // ── Static public routes per locale ──────────────────────
  const staticRoutes = ['', '/catalog', '/about']

  for (const locale of locales) {
    for (const route of staticRoutes) {
      entries.push({
        url: `${siteUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'weekly' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
    }
  }

  // ── x-default ──────────────────────────────────────────
  entries.push({
    url: `${siteUrl}/${defaultLocale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1.0,
  })

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
      // Use the flower's updated_at if available, otherwise the global lastModified
      const lastModified = flower.updatedAt ? new Date(flower.updatedAt) : new Date()

      for (const locale of locales) {
        entries.push({
          url: `${siteUrl}/${locale}/flower/${flower.id}`,
          lastModified,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    }
  } catch {
    // Sitemap generation should not crash the build if DB is unavailable
    // (e.g. during Docker/image build where no DB connection exists).
    // The sitemap will be generated at runtime on the production server.
    console.warn('[sitemap] Could not fetch products from Payload — returning static entries only.')
  }

  return entries
}