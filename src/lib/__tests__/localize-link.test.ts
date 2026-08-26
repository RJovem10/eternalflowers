/**
 * @vitest-environment jsdom
 *
 * Testes para o helper localizeLink — normalização de links internos com locale.
 */
import { describe, it, expect } from 'vitest'
import { localizeLink } from '@/lib/localize-link'

describe('localizeLink — internal links get locale prefix', () => {
  it('/catalog → /{locale}/catalog', () => {
    expect(localizeLink('/catalog', 'en')).toBe('/en/catalog')
    expect(localizeLink('/about', 'pt')).toBe('/pt/about')
  })

  it('replaces existing locale prefix with current locale', () => {
    expect(localizeLink('/pt/catalog', 'en')).toBe('/en/catalog')
    expect(localizeLink('/en/about', 'pt')).toBe('/pt/about')
    expect(localizeLink('/es/contacto', 'de')).toBe('/de/contacto')
  })

  it('handles locale-only links like /pt → /{locale}', () => {
    expect(localizeLink('/pt', 'en')).toBe('/en')
    expect(localizeLink('/en', 'pt')).toBe('/pt')
  })

  it('bare word without leading "/" is passed through unchanged', () => {
    expect(localizeLink('catalog', 'en')).toBe('catalog')
    expect(localizeLink('about', 'pt')).toBe('about')
  })

  it('returns external URLs unchanged', () => {
    expect(localizeLink('https://example.com', 'pt')).toBe('https://example.com')
    expect(localizeLink('http://example.com', 'pt')).toBe('http://example.com')
  })

  it('returns mailto: and tel: unchanged', () => {
    expect(localizeLink('mailto:test@test.com', 'pt')).toBe('mailto:test@test.com')
    expect(localizeLink('tel:+351123456789', 'pt')).toBe('tel:+351123456789')
  })

  it('returns # and #... links unchanged', () => {
    expect(localizeLink('#', 'pt')).toBe('#')
    expect(localizeLink('#atelier', 'pt')).toBe('#atelier')
    expect(localizeLink('#section-2', 'en')).toBe('#section-2')
  })

  it('returns null for null/undefined/empty', () => {
    expect(localizeLink(null, 'pt')).toBeNull()
    expect(localizeLink(undefined, 'pt')).toBeNull()
    expect(localizeLink('', 'pt')).toBeNull()
  })

  it('works for all 5 locales', () => {
    for (const locale of ['pt', 'en', 'es', 'it', 'de']) {
      expect(localizeLink('/catalog', locale)).toBe(`/${locale}/catalog`)
    }
  })
})