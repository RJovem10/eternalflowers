/**
 * @vitest-environment jsdom
 *
 * Testes para a página /care (Guia de Cuidados) — versão i18n.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import fs from 'fs'
import path from 'path'
import { dictionaries, locales } from '@/i18n/dictionaries'
import Footer from '@/components/Footer'

// ═══════════════════════════════════════════════════════════════
// 1. Assets PNG — todos os 5 existem
// ═══════════════════════════════════════════════════════════════

const posters: Record<string, string> = {
  pt: 'eternal-flowers-care-guide-pt.png',
  en: 'eternal-flowers-care-guide-en.png',
  es: 'eternal-flowers-care-guide-es.png',
  it: 'eternal-flowers-care-guide-it.png',
  de: 'eternal-flowers-care-guide-de.png',
}

const guidesDir = path.resolve(__dirname, '../../../../../../public/images/guides')

describe('Care guide assets — all 5 PNGs exist', () => {
  it.each(Object.entries(posters))('%s → %s existe', (locale, filename) => {
    const pngPath = path.join(guidesDir, filename)
    expect(fs.existsSync(pngPath)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. Dict keys — todos os locales têm todas as chaves
// ═══════════════════════════════════════════════════════════════

const requiredKeys = [
  'careGuide', 'careEyebrow', 'careTitle', 'careIntro',
  'careVisualGuideTitle',
  'care1Title', 'care1', 'care2Title', 'care2',
  'care3Title', 'care3', 'care4Title', 'care4',
  'care5Title', 'care5',
  'careCleaningTitle', 'careCleaning',
  'careWetTitle', 'careWet',
  'careWarrantyTitle', 'careWarranty',
  'careContact', 'careLegal',
  'careFaqTitle',
  'careFaq1Q', 'careFaq1A',
  'careFaq2Q', 'careFaq2A',
  'careFaq3Q', 'careFaq3A',
  'careFaq4Q', 'careFaq4A',
  'careFinalCta', 'careCollectionCta',
  'careSeoTitle', 'careSeoDescription',
  'careSaveButton', 'careOpenButton',
]

describe('careGuide dictionary keys', () => {
  it.each(locales)('%s tem todas as chaves careGuide', (locale) => {
    for (const key of requiredKeys) {
      expect(dictionaries[locale]).toHaveProperty(key)
    }
  })

  it('careGuide difere por locale', () => {
    const values = locales.map((l) => dictionaries[l].careGuide)
    const unique = new Set(values)
    expect(unique.size).toBe(locales.length)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. Conteúdo traduzido — verificação específica por locale
// ═══════════════════════════════════════════════════════════════

describe('Translated content per locale', () => {
  it('PT: "saquinho de sílica" e "pano de limpeza"', () => {
    const d = dictionaries.pt
    expect(d.care5).toContain('saquinho de sílica')
    expect(d.careCleaning).toContain('pano de limpeza')
    expect(d.careWarrantyTitle).toContain('garantia')
  })

  it('EN: "silica gel sachet" and "cleaning cloth"', () => {
    const d = dictionaries.en
    expect(d.care5).toContain('silica gel sachet')
    expect(d.careCleaning).toContain('cleaning cloth')
    expect(d.careWarrantyTitle).toContain('guarantee')
  })

  it('ES: "bolsita de gel de sílice" y "paño de limpieza"', () => {
    const d = dictionaries.es
    expect(d.care5).toContain('bolsita de gel de sílice')
    expect(d.careCleaning).toContain('paño de limpieza')
    expect(d.careWarrantyTitle).toContain('garantía')
  })

  it('IT: "bustina di gel di silice" e "panno fornito"', () => {
    const d = dictionaries.it
    expect(d.care5).toContain('gel di silice')
    expect(d.careCleaning).toContain('panno fornito')
    expect(d.careWarrantyTitle).toContain('garanzia')
  })

  it('DE: "Silicagel-Beutel" und "Reinigungstuch"', () => {
    const d = dictionaries.de
    expect(d.care5).toContain('Silicagel-Beutel')
    expect(d.careCleaning).toContain('Reinigungstuch')
    expect(d.careWarrantyTitle).toContain('Garantie')
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. FAQ — cada locale tem 4 perguntas
// ═══════════════════════════════════════════════════════════════

describe('FAQ per locale', () => {
  it.each(locales)('%s tem 4 FAQs', (locale) => {
    const d = dictionaries[locale]
    expect(d.careFaq1Q).toBeTruthy()
    expect(d.careFaq1A).toBeTruthy()
    expect(d.careFaq2Q).toBeTruthy()
    expect(d.careFaq2A).toBeTruthy()
    expect(d.careFaq3Q).toBeTruthy()
    expect(d.careFaq3A).toBeTruthy()
    expect(d.careFaq4Q).toBeTruthy()
    expect(d.careFaq4A).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. SEO — title e description por locale
// ═══════════════════════════════════════════════════════════════

describe('SEO metadata', () => {
  it.each(locales)('%s tem careSeoTitle e careSeoDescription', (locale) => {
    const d = dictionaries[locale]
    expect(d.careSeoTitle).toBeTruthy()
    expect(d.careSeoDescription).toBeTruthy()
  })

  it('SEO titles diferem por locale', () => {
    const titles = locales.map((l) => dictionaries[l].careSeoTitle)
    const unique = new Set(titles)
    expect(unique.size).toBe(locales.length)
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. Footer — link locale-aware e label traduzida
// ═══════════════════════════════════════════════════════════════

describe('Footer care guide link', () => {
  it.each(locales)('Footer %s mostra careGuide label e href locale-aware', (locale) => {
    const dict = { ...dictionaries[locale] }
    const { unmount } = render(
      <Footer locale={locale} dict={dict} />
    )

    const link = screen.getByText(dict.careGuide)
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', `/${locale}/care`)
    unmount()
  })
})

// ═══════════════════════════════════════════════════════════════
// 7. Rota /care page existe
// ═══════════════════════════════════════════════════════════════

describe('Care page route existence', () => {
  it('ficheiro page.tsx existe em [locale]/care', () => {
    const pagePath = path.resolve(
      process.cwd(),
      'src/app/(frontend)/[locale]/care/page.tsx'
    )
    expect(fs.existsSync(pagePath)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 8. Conteúdo textual na página — poster i18n
// ═══════════════════════════════════════════════════════════════

describe('Page content (source-level checks)', () => {
  const pageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/[locale]/care/page.tsx'),
    'utf-8'
  )

  it('usa dict.xxx em vez de texto hardcoded PT nos locais sensíveis', () => {
    // 5 cuidados usam dict
    expect(pageContent).toContain('title={dict.care1Title}')
    expect(pageContent).toContain('title={dict.care2Title}')
    expect(pageContent).toContain('title={dict.care3Title}')
    expect(pageContent).toContain('title={dict.care4Title}')
    expect(pageContent).toContain('title={dict.care5Title}')
  })

  it('FAQ usa dict.careFaq*', () => {
    expect(pageContent).toContain('question={dict.careFaq1Q}')
    expect(pageContent).toContain('question={dict.careFaq2Q}')
    expect(pageContent).toContain('question={dict.careFaq3Q}')
    expect(pageContent).toContain('question={dict.careFaq4Q}')
  })

  it('SEO usa dict.careSeoTitle e dict.careSeoDescription', () => {
    expect(pageContent).toContain('dict.careSeoTitle')
    expect(pageContent).toContain('dict.careSeoDescription')
  })

  it('JSON-LD FAQ usa dict.careFaq*', () => {
    expect(pageContent).toContain('name: dict.careFaq1Q')
    expect(pageContent).toContain('text: dict.careFaq1A')
  })

  it('JÁ NÃO usa {isPt && ( — poster é mostrado em todos os locales', () => {
    expect(pageContent).not.toContain('{isPt && (')
  })

  it('poster é selecionado dinamicamente via posterMap', () => {
    expect(pageContent).toContain('const posterMap')
    expect(pageContent).toContain('const poster = posterMap[locale] || posterMap.pt')
  })

  it('posterMap contém todos os 5 locales', () => {
    expect(pageContent).toContain("pt: { file: 'eternal-flowers-care-guide-pt.png'")
    expect(pageContent).toContain("en: { file: 'eternal-flowers-care-guide-en.png'")
    expect(pageContent).toContain("es: { file: 'eternal-flowers-care-guide-es.png'")
    expect(pageContent).toContain("it: { file: 'eternal-flowers-care-guide-it.png'")
    expect(pageContent).toContain("de: { file: 'eternal-flowers-care-guide-de.png'")
  })

  it('posterMap contém download filenames por locale', () => {
    expect(pageContent).toContain("download: 'guia-cuidados-eternal-flowers.png'")
    expect(pageContent).toContain("download: 'care-guide-eternal-flowers.png'")
    expect(pageContent).toContain("download: 'guida-cura-eternal-flowers.png'")
    expect(pageContent).toContain("download: 'pflegeleitfaden-eternal-flowers.png'")
  })

  it('Image src usa template string com poster.file', () => {
    expect(pageContent).toContain("src={`/images/guides/${poster.file}`}")
  })

  it('link Save (download) usa template string com poster.file e poster.download', () => {
    expect(pageContent).toContain("href={`/images/guides/${poster.file}`}")
    expect(pageContent).toContain('download={poster.download}')
  })

  it('link Open (target=_blank) usa template string com poster.file', () => {
    // Part of the two href lines with poster.file
    const hrefMatches = (pageContent.match(/href={`\/images\/guides\/\$\{poster\.file\}`}/g) || []).length
    expect(hrefMatches).toBeGreaterThanOrEqual(2) // save + open
  })

  it('não contém href hardcoded PT para o poster (usa template)', () => {
    expect(pageContent).not.toContain("href=\"/images/guides/eternal-flowers-care-guide-pt.png\"")
  })

  it('não contém texto hardcoded PT nos cuidados (usa dict)', () => {
    // These PT phrases should NOT appear as JSX text (they come from dict)
    expect(pageContent).not.toContain('Mantenha a peça seca')
    expect(pageContent).not.toContain('Perfume primeiro. Joia depois.')
    expect(pageContent).not.toContain('Use com delicadeza')
  })

  it('página não depende de JS para mostrar cuidados (usa <details>/<summary>)', () => {
    expect(pageContent).toContain('<details')
    expect(pageContent).toContain('<summary')
    expect(pageContent).not.toContain("'use client'")
    expect(pageContent).not.toContain('"use client"')
  })

  it('exporta generateMetadata', () => {
    expect(pageContent).toContain('export async function generateMetadata')
  })

  it('exporta o componente default', () => {
    expect(pageContent).toContain('export default async function CarePage')
  })

  it('comentário com futuras locales foi substituído', () => {
    expect(pageContent).not.toContain('The poster image files for future locale')
  })

  // ═══════════════════════════════════════════════════════════════
  // 9. WhatsApp — usa NEXT_PUBLIC_WHATSAPP_NUMBER
  // ═══════════════════════════════════════════════════════════════

  it('whatsapp href usa process.env.NEXT_PUBLIC_WHATSAPP_NUMBER', () => {
    expect(pageContent).toContain('process.env.NEXT_PUBLIC_WHATSAPP_NUMBER')
  })

  it('whatsapp href constrói wa.me/<numero>', () => {
    expect(pageContent).toContain("`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER")
  })

  it('whatsapp href tem fallback 351000000000', () => {
    expect(pageContent).toContain("process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '351000000000'")
  })
})