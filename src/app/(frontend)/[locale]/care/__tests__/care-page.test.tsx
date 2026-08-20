/**
 * @vitest-environment jsdom
 *
 * Testes para a página /care (Guia de Cuidados).
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
// 1. Asset PNG existe
// ═══════════════════════════════════════════════════════════════

describe('Care guide asset', () => {
  it('PNG existe no directório public', () => {
    // Resolve a partir da raiz do projecto
    const pngPath = path.resolve(
      __dirname,
      '../../../../../../public/images/guides/eternal-flowers-care-guide-pt.png'
    )
    expect(fs.existsSync(pngPath)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. Dict keys
// ═══════════════════════════════════════════════════════════════

describe('Dictionary entries', () => {
  it('careGuide existe em todos os locales', () => {
    for (const locale of locales) {
      expect(dictionaries[locale]).toHaveProperty('careGuide')
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. Footer — link locale-aware
// ═══════════════════════════════════════════════════════════════

describe('Footer care guide link', () => {
  it('renderiza link "Guia de cuidados" com href locale-aware', () => {
    const dict = { ...dictionaries.pt }
    render(
      <Footer
        locale="pt"
        dict={dict}
      />
    )

    const link = screen.getByText('Guia de cuidados')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/pt/care')
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. Rota /care page existe para todos os locales
// ═══════════════════════════════════════════════════════════════

describe('Care page route existence', () => {
  it('ficheiro page.tsx existe em todos os locale dirs esperados', () => {
    // Only one file under [locale]/care - the i18n architecture serves all locales
    const pagePath = path.resolve(
      process.cwd(),
      'src/app/(frontend)/[locale]/care/page.tsx'
    )
    expect(fs.existsSync(pagePath)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. Conteúdo textual estático no ficheiro da página
// ═══════════════════════════════════════════════════════════════

describe('Page content (source-level checks)', () => {
  const pageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/[locale]/care/page.tsx'),
    'utf-8'
  )

  it('contém os 5 cuidados essenciais', () => {
    expect(pageContent).toContain('Mantenha a peça seca')
    expect(pageContent).toContain('Perfume primeiro. Joia depois.')
    expect(pageContent).toContain('Proteja-a do sol e do calor')
    expect(pageContent).toContain('Use com delicadeza')
    expect(pageContent).toContain('Guarde-a com carinho')
  })

  it('"pano fornecido" está explicitamente referido', () => {
    const matches = pageContent.match(/pano fornecido/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(3)
  })

  it('"saquinho de sílica" está explicitamente referido', () => {
    expect(pageContent).toContain('saquinho de sílica')
  })

  it('garantia está presente', () => {
    expect(pageContent).toContain('A sua peça tem garantia')
  })

  it('FAQ contém exatamente as 4 perguntas definidas', () => {
    expect(pageContent).toContain('Posso usar a joia à chuva')
    expect(pageContent).toContain('Posso usar perfume')
    expect(pageContent).toContain('Onde devo guardar a peça')
    expect(pageContent).toContain('Como devo limpar a joia')
  })

  it('link "Guardar guia" aponta para o PNG original', () => {
    expect(pageContent).toContain('download="guia-cuidados-eternal-flowers.png"')
    expect(pageContent).toContain(
      'href="/images/guides/eternal-flowers-care-guide-pt.png"'
    )
  })

  it('página não depende de JS para mostrar cuidados (usa <details>/<summary>)', () => {
    expect(pageContent).toContain('<details')
    expect(pageContent).toContain('<summary')
    // No "use client" directive — runs as server component
    expect(pageContent).not.toContain("'use client'")
    expect(pageContent).not.toContain('"use client"')
  })

  it('exporta generateMetadata', () => {
    expect(pageContent).toContain('export async function generateMetadata')
    expect(pageContent).toContain('Guia de Cuidados das Joias | Eternal Flowers')
  })

  it('exporta o componente default', () => {
    expect(pageContent).toContain('export default async function CarePage')
  })
})