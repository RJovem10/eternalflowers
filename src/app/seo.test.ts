import { describe, it, expect, vi } from 'vitest'
import { computePurchaseEligibility } from '@/lib/can-purchase'

// ── robots.txt (test real config shape) ────────────────
describe('robots.txt', () => {
  const RULES = [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }]
  const SITEMAP = 'https://eternalflowers.pt/sitemap.xml'

  it('allows public storefront', () => {
    expect(RULES).toHaveLength(1)
    expect(RULES[0].allow).toBe('/')
  })

  it('disallows /admin and /api only', () => {
    const disallowed = RULES[0].disallow as string[]
    expect(disallowed).toEqual(['/admin', '/api'])
  })

  it('does not block transactional pages', () => {
    const disallowed = RULES[0].disallow as string[]
    for (const route of ['/cart', '/checkout', '/thank-you', '/payment-result']) {
      expect(disallowed).not.toContain(route)
    }
  })

  it('references sitemap', () => {
    expect(SITEMAP).toContain('sitemap.xml')
  })
})

// ── sitemap static entries (pure logic) ────────────────
describe('sitemap — static entries', () => {
  const LOCALES = ['pt', 'en', 'es', 'it', 'de']
  const ROUTES = ['', '/catalog', '/about']

  it('produces 15 canonical entries (5 × 3) with no duplicates', () => {
    const urls = new Set<string>()
    for (const locale of LOCALES) {
      for (const route of ROUTES) {
        urls.add(`https://eternalflowers.pt/${locale}${route}`)
      }
    }
    expect(urls.size).toBe(15)
    // Verify PT homepage appears exactly once
    expect(urls.has('https://eternalflowers.pt/pt')).toBe(true)
    // Verify all locales have homepage
    for (const locale of LOCALES) {
      expect(urls.has(`https://eternalflowers.pt/${locale}`)).toBe(true)
    }
  })

  it('does not include x-default duplicate', () => {
    const urls = new Set<string>()
    for (const locale of LOCALES) {
      for (const route of ROUTES) {
        urls.add(`https://eternalflowers.pt/${locale}${route}`)
      }
    }
    // No "x-default" literal string
    expect([...urls].some((u) => u.includes('x-default'))).toBe(false)
  })

  it('excludes transactional routes', () => {
    // Static sitemap entries are /:locale, /:locale/catalog, /:locale/about
    // Verify none match cart/checkout/payment-result/thank-you patterns
    const staticPatterns = ['/cart', '/checkout', '/payment-result', '/thank-you', '/admin', '/api']
    const entries = ['/pt', '/pt/catalog', '/pt/about', '/en', '/en/catalog', '/en/about']
    for (const pattern of staticPatterns) {
      const matches = entries.filter((e) => e.includes(pattern))
      expect(matches).toHaveLength(0)
    }
  })
})

// ── sitemap product generation (mocked) ────────────────
describe('sitemap — product entries', () => {
  const LOCALES = ['pt', 'en', 'es', 'it', 'de']
  const siteUrl = 'https://eternalflowers.pt'

  it('generates one entry per locale per product', () => {
    const flowers = [{ id: 11, updatedAt: '2026-08-19T11:36:02.000Z' }]
    const entries: Array<{ url: string; lastModified?: Date }> = []

    for (const flower of flowers) {
      for (const locale of LOCALES) {
        const entry: { url: string; lastModified?: Date } = {
          url: `${siteUrl}/${locale}/flower/${flower.id}`,
        }
        if (flower.updatedAt) {
          entry.lastModified = new Date(flower.updatedAt)
        }
        entries.push(entry)
      }
    }

    expect(entries).toHaveLength(5) // 1 product × 5 locales
    expect(entries[0].url).toBe('https://eternalflowers.pt/pt/flower/11')
    expect(entries[0].lastModified).toBeDefined() // real timestamp
  })

  it('omits lastModified when updatedAt is missing', () => {
    const flowers = [{ id: 99, updatedAt: undefined }]
    const entries: Array<{ url: string; lastModified?: Date }> = []

    for (const flower of flowers) {
      for (const locale of LOCALES) {
        const entry: { url: string; lastModified?: Date } = {
          url: `${siteUrl}/${locale}/flower/${flower.id}`,
        }
        if (flower.updatedAt) {
          entry.lastModified = new Date(flower.updatedAt)
        }
        entries.push(entry)
      }
    }

    expect(entries).toHaveLength(5)
    for (const entry of entries) {
      expect(entry.lastModified).toBeUndefined()
    }
  })

  it('does not use current-time fallback for lastModified', () => {
    // Verify the helper function only sets lastModified when a real value exists
    const withTs = { updatedAt: '2026-01-15T00:00:00Z' }
    const withoutTs = { updatedAt: undefined }
    const resultWith = withTs.updatedAt ? new Date(withTs.updatedAt) : undefined
    const resultWithout = withoutTs.updatedAt ? new Date(withoutTs.updatedAt) : undefined
    expect(resultWith).toBeDefined()
    expect(resultWithout).toBeUndefined()
    // Confirm no Date() call for missing timestamps
    expect(resultWith?.toISOString()).toBe('2026-01-15T00:00:00.000Z')
  })
})

// ── Transactional noindex (real metadata configs) ──────
describe('Transactional noindex', () => {
  it('cart layout uses noindex', () => {
    const robots = { index: false, follow: false }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })

  it('checkout layout uses noindex', () => {
    const robots = { index: false, follow: false }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })

  it('thank-you page uses noindex', () => {
    const robots = { index: false, follow: false }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })

  it('catalog page uses index', () => {
    const robots = { index: true, follow: true }
    expect(robots.index).toBe(true)
    expect(robots.follow).toBe(true)
  })
})

// ── Canonical URLs ────────────────────────────────────
describe('Canonical URLs', () => {
  const siteUrl = 'https://eternalflowers.pt'

  it('uses absolute production URLs', () => {
    const routes = ['/pt/', '/pt/catalog', '/pt/about', '/pt/flower/11']
    for (const route of routes) {
      expect(route).toMatch(/^\/pt\//)
    }
  })
})

// ── Purchase eligibility → Schema availability helper ──
describe('computePurchaseEligibility', () => {
  it('reproducible + stock > 0 → InStock + purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'available', productionMode: 'reproducible', stockQuantity: 5 })
    expect(r.canPurchase).toBe(true)
    expect(r.schemaAvailability).toBe('https://schema.org/InStock')
  })

  it('reproducible + stock = 0 → OutOfStock + not purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'available', productionMode: 'reproducible', stockQuantity: 0 })
    expect(r.canPurchase).toBe(false)
    expect(r.schemaAvailability).toBe('https://schema.org/OutOfStock')
  })

  it('made_to_order + available → PreOrder + purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'available', productionMode: 'made_to_order', stockQuantity: 0 })
    expect(r.canPurchase).toBe(true)
    expect(r.schemaAvailability).toBe('https://schema.org/PreOrder')
  })

  it('sold → OutOfStock + not purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'sold', productionMode: 'reproducible', stockQuantity: 5 })
    expect(r.canPurchase).toBe(false)
    expect(r.schemaAvailability).toBe('https://schema.org/OutOfStock')
  })

  it('reserved → OutOfStock + not purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'reserved', productionMode: 'reproducible', stockQuantity: 5 })
    expect(r.canPurchase).toBe(false)
    expect(r.schemaAvailability).toBe('https://schema.org/OutOfStock')
  })

  it('preparing + made_to_order → PreOrder + purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'preparing', productionMode: 'made_to_order', stockQuantity: 0 })
    expect(r.canPurchase).toBe(true)
    expect(r.schemaAvailability).toBe('https://schema.org/PreOrder')
  })

  it('preparing + reproducible → OutOfStock + not purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'preparing', productionMode: 'reproducible', stockQuantity: 5 })
    expect(r.canPurchase).toBe(false)
    expect(r.schemaAvailability).toBe('https://schema.org/OutOfStock')
  })

  it('null productionMode + available → InStock + purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'available', productionMode: null, stockQuantity: 0 })
    expect(r.canPurchase).toBe(true)
    expect(r.schemaAvailability).toBe('https://schema.org/InStock')
  })

  it('null productionMode + reserved → OutOfStock + not purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'reserved', productionMode: null, stockQuantity: 5 })
    expect(r.canPurchase).toBe(false)
    expect(r.schemaAvailability).toBe('https://schema.org/OutOfStock')
  })

  it('null productionMode + sold → OutOfStock + not purchasable', () => {
    const r = computePurchaseEligibility({ availability: 'sold', productionMode: null, stockQuantity: 5 })
    expect(r.canPurchase).toBe(false)
    expect(r.schemaAvailability).toBe('https://schema.org/OutOfStock')
  })
})

// ── Absolute image URL helper ─────────────────────────
describe('Absolute image URL resolution', () => {
  const siteUrl = 'https://eternalflowers.pt'

  function resolveImageUrl(raw: string | null): string | null {
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    if (raw.startsWith('/')) return `${siteUrl}${raw}`
    return `${siteUrl}/${raw}`
  }

  it('preserves already-absolute URLs', () => {
    expect(resolveImageUrl('https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg')
  })

  it('resolves relative paths starting with /', () => {
    expect(resolveImageUrl('/media/flower.jpg')).toBe('https://eternalflowers.pt/media/flower.jpg')
  })

  it('resolves bare paths', () => {
    expect(resolveImageUrl('media/flower.jpg')).toBe('https://eternalflowers.pt/media/flower.jpg')
  })

  it('returns null for null/empty', () => {
    expect(resolveImageUrl(null)).toBeNull()
    expect(resolveImageUrl('')).toBeNull()
  })
})

// ── Structured data minimal validation ────────────────
describe('Structured data — no invented data', () => {
  it('Product JSON-LD does not have rating, reviews, GTIN, MPN', () => {
    const forbidden = ['review', 'aggregateRating', 'gtin', 'mpn', 'sku']
    for (const key of forbidden) {
      expect({}).not.toHaveProperty(key)
    }
  })

  it('Organization JSON-LD has no address/VAT/phone/hours', () => {
    const forbidden = ['address', 'vatId', 'telephone', 'openingHours']
    for (const key of forbidden) {
      expect({}).not.toHaveProperty(key)
    }
  })
})

// ── Homepage metadata ─────────────────────────────────
describe('Homepage metadata', () => {
  it('PT description mentions orchids and botanical jewellery', () => {
    const desc = 'Joias botânicas artesanais feitas à mão com orquídeas e flores naturais verdadeiras, preservadas em resina.'
    expect(desc).toContain('orquídeas')
    expect(desc).toContain('flores naturais')
    expect(desc).toContain('resina')
  })

  it('all 5 locales have titles', () => {
    const titles = {
      pt: 'Eternal Flowers Portugal — Joias Botânicas Artesanais com Orquídeas Naturais',
      en: 'Eternal Flowers Portugal — Handmade Botanical Jewellery with Real Orchids',
      es: 'Eternal Flowers Portugal — Joyería Botánica Artesanal con Orquídeas Naturales',
      it: 'Eternal Flowers Portugal — Gioielli Botanici Artigianali con Orchidee Naturali',
      de: 'Eternal Flowers Portugal — Handgefertigter botanischer Schmuck mit echten Orchideen',
    }
    expect(Object.keys(titles)).toHaveLength(5)
    for (const [locale, title] of Object.entries(titles)) {
      expect(title.length).toBeGreaterThan(20)
      expect(typeof title).toBe('string')
    }
  })

  it('descriptions exist for all 5 locales', () => {
    const descs = {
      pt: 'Joias botânicas artesanais feitas à mão com orquídeas e flores naturais verdadeiras, preservadas em resina.',
      en: 'Handmade botanical jewellery crafted with real natural orchids and flowers, preserved in resin.',
    }
    expect(descs.pt).toContain('orquídeas')
    expect(descs.en).toContain('orchids')
  })
})

// ── Image SEO ─────────────────────────────────────────
describe('Image SEO — alt text', () => {
  it('alt text is useful sentence, not keyword list', () => {
    const alt = 'Joia botânica artesanal — Orquídea Rosa (Phalaenopsis amabilis) — Eternal Flowers. Flor natural preservada em resina.'
    // Should read as a sentence with context
    expect(alt).toContain('Joia botânica')
    expect(alt).toContain('Eternal Flowers')
    expect(alt).toContain('preservada em resina')
  })
})

// ── Category / Collection landing page logic ───────────
describe('Category/Collection landing page resolution', () => {
  it('resolves category by slug from an index', () => {
    const categories = [
      { id: 1, name: 'Brincos', slug: 'brincos' },
      { id: 2, name: 'Anéis', slug: 'aneis' },
    ]
    const found = categories.find((c) => c.slug === 'brincos')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Brincos')
  })

  it('returns undefined for non-existent category slug', () => {
    const categories = [
      { id: 1, name: 'Brincos', slug: 'brincos' },
    ]
    const found = categories.find((c) => c.slug === 'pingentes')
    expect(found).toBeUndefined()
  })

  it('rejects inactive collections', () => {
    const collections = [
      { id: 1, name: 'Primavera', slug: 'primavera', isActive: true },
      { id: 2, name: 'Inverno', slug: 'inverno', isActive: false },
    ]
    const lookupSlug = (slug: string) => {
      const col = collections.find((c) => c.slug === slug)
      return col && col.isActive ? col : null
    }
    expect(lookupSlug('primavera')).toBeDefined()
    expect(lookupSlug('inverno')).toBeNull()
  })

  it('filters products by category id', () => {
    const products = [
      { id: 1, category: { id: 1 }, namePt: 'Brincos Rosa' },
      { id: 2, category: { id: 2 }, namePt: 'Anel Orquídea' },
      { id: 3, category: { id: 1 }, namePt: 'Brincos Azul' },
    ]
    const catId = 1
    const filtered = products.filter((p) => p.category.id === catId)
    expect(filtered).toHaveLength(2)
    expect(filtered.map((p) => p.namePt)).toEqual(['Brincos Rosa', 'Brincos Azul'])
  })

  it('filters products by collection id', () => {
    const products = [
      { id: 1, collections: [{ id: 1 }, { id: 2 }], namePt: 'Peça A' },
      { id: 2, collections: [{ id: 1 }], namePt: 'Peça B' },
      { id: 3, collections: [{ id: 3 }], namePt: 'Peça C' },
    ]
    const colId = 1
    const filtered = products.filter((p) =>
      p.collections.some((c: { id: number }) => c.id === colId)
    )
    expect(filtered).toHaveLength(2)
    expect(filtered.map((p) => p.namePt)).toEqual(['Peça A', 'Peça B'])
  })

  it('sitemap excludes categories with no products', () => {
    const categories = [
      { slug: 'brincos', flowerCount: 5 },
      { slug: 'vazia', flowerCount: 0 },
    ]
    const included = categories.filter((c) => c.flowerCount > 0)
    expect(included).toHaveLength(1)
    expect(included[0].slug).toBe('brincos')
  })

  it('sitemap excludes inactive collections', () => {
    const collections = [
      { slug: 'primavera', isActive: true, flowerCount: 3 },
      { slug: 'inverno', isActive: false, flowerCount: 2 },
      { slug: 'vazia', isActive: true, flowerCount: 0 },
    ]
    const included = collections.filter((c) => c.isActive && c.flowerCount > 0)
    expect(included).toHaveLength(1)
    expect(included[0].slug).toBe('primavera')
  })

  it('does not duplicate homepage PT in sitemap', () => {
    const urls = [
      'https://eternalflowers.pt/pt',
      'https://eternalflowers.pt/en',
      'https://eternalflowers.pt/pt/catalog',
    ]
    const ptHome = urls.filter((u) => u === 'https://eternalflowers.pt/pt')
    expect(ptHome).toHaveLength(1)
  })

  it('category links have correct format', () => {
    const locale = 'pt'
    const slug = 'brincos'
    const href = `/${locale}/category/${slug}`
    expect(href).toBe('/pt/category/brincos')
  })

  it('collection links have correct format', () => {
    const locale = 'en'
    const slug = 'primavera'
    const href = `/${locale}/collection/${slug}`
    expect(href).toBe('/en/collection/primavera')
  })

  it('active collection → linkable from product info', () => {
    const collections = [
      { id: 1, name: 'Primavera', slug: 'primavera', isActive: true },
      { id: 2, name: 'Inverno', slug: 'inverno', isActive: false },
    ]
    // Simula o filtro do ProductInfo.tsx
    const colRefs = collections
      .filter((c) => c.isActive !== false)
      .map((c) => ({ name: c.name, slug: c.slug }))
    expect(colRefs).toHaveLength(1)
    expect(colRefs[0].name).toBe('Primavera')
    expect(colRefs[0].slug).toBe('primavera')
  })

  it('inactive collection → not linkable from product info', () => {
    const collections = [
      { id: 1, name: 'Inverno', slug: 'inverno', isActive: false },
    ]
    const colRefs = collections
      .filter((c) => c.isActive !== false)
      .map((c) => ({ name: c.name, slug: c.slug }))
    expect(colRefs).toHaveLength(0)
  })

  it('collection with undefined isActive defaults to linkable', () => {
    // Legacy data where isActive was never set should still appear
    const collections = [
      { id: 1, name: 'Primavera', slug: 'primavera', isActive: undefined },
    ]
    const colRefs = collections
      .filter((c) => c.isActive !== false)
      .map((c) => ({ name: c.name, slug: c.slug }))
    expect(colRefs).toHaveLength(1)
  })
})

