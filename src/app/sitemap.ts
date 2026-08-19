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

  // ── Category pages ──────────────────────────────────────
  try {
    const payload = await getPayload({ config })

    const categories = await payload.find({
      collection: 'categories',
      limit: 100,
      depth: 0,
      pagination: false,
    })

    const catSlugs = new Set<number>()

    // Only include categories that have at least one public product
    for (const cat of categories.docs) {
      const flowerCount = await payload.count({
        collection: 'flowers',
        where: {
          category: { equals: cat.id },
          isPublic: { equals: true },
        },
      })
      if (flowerCount.totalDocs > 0) {
        catSlugs.add(cat.id)
        for (const locale of locales) {
          entries.push({
            url: `${siteUrl}/${locale}/category/${cat.slug}`,
            changeFrequency: 'weekly',
            priority: 0.7,
          })
        }
      }
    }

    // ── Collection pages ─────────────────────────────────────
    const collections = await payload.find({
      collection: 'collections',
      where: { isActive: { equals: true } },
      limit: 100,
      depth: 0,
      pagination: false,
    })

    for (const col of collections.docs) {
      const flowerCount = await payload.count({
        collection: 'flowers',
        where: {
          collections: { in: col.id },
          isPublic: { equals: true },
        },
      })
      if (flowerCount.totalDocs > 0) {
        for (const locale of locales) {
          entries.push({
            url: `${siteUrl}/${locale}/collection/${col.slug}`,
            changeFrequency: 'weekly',
            priority: 0.7,
          })
        }
      }
    }

    // ── Product pages from Payload (only public) ───────────
    const flowers = await payload.find({
      collection: 'flowers',
      limit: 500,
      depth: 0,
      pagination: false,
      where: { isPublic: { equals: true } },
    })

    for (const flower of flowers.docs) {
      const entry: MetadataRoute.Sitemap[number] = {
        url: `${siteUrl}/pt/flower/${flower.id}`,
        changeFrequency: 'monthly',
        priority: 0.6,
      }

      if (flower.updatedAt) {
        entry.lastModified = new Date(flower.updatedAt)
      }

      for (const locale of locales) {
        const localizedEntry = { ...entry, url: `${siteUrl}/${locale}/flower/${flower.id}` }
        entries.push(localizedEntry)
      }
    }
  } catch {
    console.warn('[sitemap] Payload unavailable — returning static entries only. Will retry on next request.')
  }

  return entries
}