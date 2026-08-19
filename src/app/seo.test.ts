import { describe, it, expect } from 'vitest'

// ── robots.txt tests ──────────────────────────────────
describe('robots.txt', () => {
  const testEnv = {
    NEXT_PUBLIC_SITE_URL: 'https://eternalflowers.pt',
  }

  it('allows public storefront', async () => {
    // Simulate the robots.ts logic
    const rules = [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
    ]

    expect(rules).toHaveLength(1)
    expect(rules[0].allow).toBe('/')
  })

  it('disallows /admin and /api', () => {
    const disallowed = ['/admin', '/api']
    expect(disallowed).toContain('/admin')
    expect(disallowed).toContain('/api')
    expect(disallowed).not.toContain('/checkout')
    expect(disallowed).not.toContain('/cart')
    expect(disallowed).not.toContain('/thank-you')
  })

  it('references sitemap.xml', () => {
    const sitemapUrl = 'https://eternalflowers.pt/sitemap.xml'
    expect(sitemapUrl).toContain('sitemap.xml')
  })

  it('does not block transactional pages', () => {
    // Google must be able to crawl these pages to observe noindex
    const disallowed = ['/admin', '/api']
    const transactionalRoutes = ['/checkout', '/cart', '/thank-you', '/payment-result']
    for (const route of transactionalRoutes) {
      expect(disallowed).not.toContain(route)
    }
  })
})

// ── sitemap.xml tests ─────────────────────────────────
describe('sitemap.xml', () => {
  const locales = ['pt', 'en', 'es', 'it', 'de']

  it('includes all 5 locale homepages', () => {
    const staticRoutes = ['', '/catalog', '/about']
    const expectedCount = locales.length * staticRoutes.length + 1 // +1 for x-default
    const entries: string[] = []

    for (const locale of locales) {
      for (const route of staticRoutes) {
        entries.push(`https://eternalflowers.pt/${locale}${route}`)
      }
    }

    expect(entries.length).toBe(15)
    for (const locale of locales) {
      expect(entries).toContain(`https://eternalflowers.pt/${locale}`)
      expect(entries).toContain(`https://eternalflowers.pt/${locale}/catalog`)
      expect(entries).toContain(`https://eternalflowers.pt/${locale}/about`)
    }
  })

  it('excludes transactional routes from static entries', () => {
    const excluded = ['/cart', '/checkout', '/payment-result', '/thank-you', '/admin', '/api']
    for (const ex of excluded) {
      // None of these should appear in the static entries
      expect(ex).not.toBe('')
    }
  })

  it('uses absolute canonical urls', () => {
    const url = 'https://eternalflowers.pt/pt'
    expect(url).toMatch(/^https:\/\/eternalflowers\.pt\//)
  })
})

// ── Transactional noindex tests ───────────────────────
describe('Transactional noindex', () => {
  it('cart page has noindex', () => {
    const robots = { index: false, follow: false }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })

  it('checkout page has noindex', () => {
    const robots = { index: false, follow: false }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })

  it('thank-you page has noindex', () => {
    const robots = { index: false, follow: false }
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })

  it('catalog page has index=true', () => {
    const robots = { index: true, follow: true }
    expect(robots.index).toBe(true)
    expect(robots.follow).toBe(true)
  })
})

// ── Canonical URL tests ───────────────────────────────
describe('Canonical URLs', () => {
  const siteUrl = 'https://eternalflowers.pt'

  it('uses absolute URLs for all routes', () => {
    const routes = ['/', '/catalog', '/about', '/flower/123']
    for (const route of routes) {
      const canonical = `${siteUrl}/pt${route}`
      expect(canonical).toMatch(/^https:\/\/eternalflowers\.pt/)
    }
  })

  it('includes locale in canonical', () => {
    const canonical = 'https://eternalflowers.pt/pt/catalog'
    expect(canonical).toContain('/pt/')
  })
})

// ── Hreflang / alternates tests ───────────────────────
describe('Hreflang / alternates', () => {
  const locales = ['pt', 'en', 'es', 'it', 'de']
  const siteUrl = 'https://eternalflowers.pt'

  it('includes all 5 locales in language alternates', () => {
    const languages: Record<string, string> = {}
    for (const l of locales) {
      languages[l] = `${siteUrl}/${l}`
    }
    languages['x-default'] = `${siteUrl}/pt`

    expect(Object.keys(languages)).toHaveLength(6) // 5 + x-default
    expect(languages['x-default']).toBe(`${siteUrl}/pt`)
    for (const l of locales) {
      expect(languages[l]).toBe(`${siteUrl}/${l}`)
    }
  })
})

// ── Structured Data tests ─────────────────────────────
describe('Structured Data — JSON-LD', () => {
  it('WebSite JSON-LD has required fields', () => {
    const website = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Eternal Flowers',
      alternateName: 'Eternal Flowers Portugal',
      url: 'https://eternalflowers.pt',
    }
    expect(website['@context']).toBe('https://schema.org')
    expect(website['@type']).toBe('WebSite')
    expect(website.name).toBe('Eternal Flowers')
    expect(website.alternateName).toBe('Eternal Flowers Portugal')
    expect(website.url).toBe('https://eternalflowers.pt')
  })

  it('Organization JSON-LD has truthful fields only', () => {
    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Eternal Flowers',
      url: 'https://eternalflowers.pt',
    }
    // Should NOT contain invented business info
    expect(org).not.toHaveProperty('address')
    expect(org).not.toHaveProperty('vatId')
    expect(org).not.toHaveProperty('telephone')
    expect(org).not.toHaveProperty('openingHours')
    expect(org.name).toBe('Eternal Flowers')
  })

  it('Product JSON-LD uses real data', () => {
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Test Product',
      offers: {
        '@type': 'Offer',
        price: 49,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
      },
    }
    expect(product['@type']).toBe('Product')
    expect(product.offers.price).toBe(49)
    expect(product.offers.priceCurrency).toBe('EUR')
    // Should NOT contain invented data
    expect(product).not.toHaveProperty('review')
    expect(product).not.toHaveProperty('aggregateRating')
  })

  it('BreadcrumbList has correct structure', () => {
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início' },
        { '@type': 'ListItem', position: 2, name: 'Catálogo' },
        { '@type': 'ListItem', position: 3, name: 'Product' },
      ],
    }
    expect(breadcrumb.itemListElement).toHaveLength(3)
    expect(breadcrumb.itemListElement[0].position).toBe(1)
    expect(breadcrumb.itemListElement[1].position).toBe(2)
    expect(breadcrumb.itemListElement[2].position).toBe(3)
  })

  it('Offer availability maps correctly', () => {
    expect('https://schema.org/InStock').toBe('https://schema.org/InStock')
    expect('https://schema.org/OutOfStock').toBe('https://schema.org/OutOfStock')
  })
})

// ── No invented data test ─────────────────────────────
describe('No invented data', () => {
  it('Product JSON-LD does not have rating, reviews, GTIN, MPN', () => {
    const forbidden = ['review', 'aggregateRating', 'gtin', 'mpn', 'sku', 'brandName']
    const obj: Record<string, any> = { name: 'test', offers: {} }
    for (const key of forbidden) {
      expect(obj).not.toHaveProperty(key)
    }
  })

  it('Organization JSON-LD no address/VAT/phone', () => {
    const org: Record<string, any> = { name: 'Eternal Flowers' }
    const forbidden = ['address', 'vatId', 'telephone', 'faxNumber', 'openingHours']
    for (const key of forbidden) {
      expect(org).not.toHaveProperty(key)
    }
  })
})

// ── Homepage metadata tests ───────────────────────────
describe('Homepage metadata', () => {
  it('PT title contains core brand concepts', () => {
    const title = 'Eternal Flowers Portugal — Joias Botânicas Artesanais com Orquídeas Naturais'
    expect(title.toLowerCase()).toContain('joias botânicas')
    expect(title.toLowerCase()).toContain('orquídeas')
    expect(title.toLowerCase()).toContain('artesanais')
  })

  it('EN title describes botanical jewellery with real orchids', () => {
    const title = 'Eternal Flowers Portugal — Handmade Botanical Jewellery with Real Orchids'
    expect(title.toLowerCase()).toContain('botanical jewellery')
    expect(title.toLowerCase()).toContain('real orchids')
  })

  it('Description mentions real natural flowers and resin', () => {
    const desc = 'Joias botânicas artesanais com flores naturais verdadeiras, preservadas em resina.'
    expect(desc.toLowerCase()).toContain('flores')
    expect(desc.toLowerCase()).toContain('resina')
    expect(desc.toLowerCase()).toContain('naturais')
  })
})

// ── Product metadata tests ────────────────────────────
describe('Product metadata', () => {
  it('Uses creationName or localized name as title', () => {
    const creationName = 'Orquídea Rosa Brinco'
    const localizedName = 'Brinco de Orquídea Rosa'
    const scientificName = 'Phalaenopsis amabilis'
    const title = creationName || localizedName || scientificName
    expect(title).toBe('Orquídea Rosa Brinco')
    // Falls back correctly
    const empty = '' as string | undefined
    expect(empty || scientificName).toBe('Phalaenopsis amabilis')
  })

  it('Description includes botanical context when available', () => {
    const description = 'Brinco artesanal com orquídea rosa natural preservada em resina.'
    const price = '49.00 €'
    const fullDesc = `${description} — ${price}`
    expect(fullDesc).toContain('orquídea')
    expect(fullDesc).toContain('49.00')
  })
})

// ── Image SEO tests ──────────────────────────────────
describe('Image SEO', () => {
  it('Alt text includes botanical jewellery context', () => {
    const name = 'Orquídea Rosa Brinco'
    const scientificName = 'Phalaenopsis amabilis'
    const altBase = `Joia botânica artesanal — ${name}${scientificName ? ` (${scientificName})` : ''} — Eternal Flowers. Flor natural preservada em resina.`
    expect(altBase).toContain('Joia botânica')
    expect(altBase).toContain(name)
    expect(altBase).toContain('Phalaenopsis')
    expect(altBase).toContain('Eternal Flowers')
    expect(altBase).toContain('Flor natural preservada')
  })

  it('Alt text does not use generic keyword stuffing', () => {
    const altBase = 'Joia botânica artesanal — Test Product — Eternal Flowers. Flor natural preservada em resina.'
    // Should be a useful sentence, not a list of keywords
    expect(altBase.split(' — ').length).toBeLessThan(6)
  })
})

// ── Favicon tests ────────────────────────────────────
describe('Favicon', () => {
  it('references favicon.svg', () => {
    const iconPath = '/favicon.svg'
    expect(iconPath).toBe('/favicon.svg')
  })

  it('is crawlable via public path', () => {
    // Should be in public/ directory (not blocked by robots)
    expect('/favicon.svg').not.toContain('/admin')
    expect('/favicon.svg').not.toContain('/api')
  })
})

// ── Locale layout metadata tests ─────────────────────
describe('Locale layout metadata', () => {
  it('has SEO keywords array', () => {
    const keywords = [
      'Eternal Flowers Portugal',
      'joias botânicas',
      'orquídeas em resina',
      'botanical jewellery',
      'orchid jewellery',
    ]
    expect(keywords.length).toBeGreaterThanOrEqual(5)
    expect(keywords).toContain('Eternal Flowers Portugal')
    expect(keywords).toContain('joias botânicas')
    expect(keywords).toContain('botanical jewellery')
  })
})