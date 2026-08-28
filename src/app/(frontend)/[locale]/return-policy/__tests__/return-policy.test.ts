/**
 * Testes para o conteúdo da Política de Devoluções e Reembolsos.
 * Verifica conteúdo em todos os 5 locales, secções obrigatórias,
 * e regras jurídicas específicas.
 */
import { describe, it, expect } from 'vitest'
import { returnPolicyContent } from '@/content/return-policy'
import { locales, defaultLocale } from '@/i18n/dictionaries'

describe('Return policy content — exists in all 5 locales', () => {
  it.each(locales)('%s tem conteúdo', (locale) => {
    const content = returnPolicyContent[locale]
    expect(content).toBeDefined()
    expect(content.title).toBeTruthy()
    expect(content.lastUpdated).toBeTruthy()
    expect(content.introduction).toBeTruthy()
  })

  it('nenhuma tradução está vazia', () => {
    for (const locale of locales) {
      const content = returnPolicyContent[locale]
      expect(content.title.length).toBeGreaterThan(0)
      expect(content.lastUpdated.length).toBeGreaterThan(0)
      expect(content.introduction.length).toBeGreaterThan(0)
      expect(content.modelFormTitle.length).toBeGreaterThan(0)
      expect(content.modelForm.length).toBeGreaterThan(0)
    }
  })
})

describe('Return policy — 11 required sections', () => {
  it.each(locales)('%s contém as 11 secções obrigatórias', (locale) => {
    const content = returnPolicyContent[locale]
    expect(content.sections.length).toBe(11)
    for (const section of content.sections) {
      expect(section.title).toBeTruthy()
      expect(section.body).toBeTruthy()
    }
  })
})

describe('PT — conteúdo jurídico específico', () => {
  const pt = returnPolicyContent.pt

  it('refere 14 dias', () => {
    const allText = pt.sections.map(s => s.body).join(' ')
    expect(allText).toMatch(/14\s*dias/)
  })

  it('refere que custos diretos da devolução cabem ao consumidor no exercício de livre resolução', () => {
    const section5 = pt.sections[4].body
    expect(section5).toMatch(/consumidor suporta os custos diretos/)
  })

  it('contém exceção de produtos personalizados', () => {
    const section7 = pt.sections[6].body
    expect(section7).toMatch(/personalizados/)
    expect(section7).toMatch(/não beneficiam do direito de livre resolução/)
  })

  it('NÃO contém regra genérica de "não devolvemos brincos por higiene"', () => {
    const allText = pt.sections.map(s => s.body).join(' ')
    expect(allText).not.toMatch(/brincos?.*higiene|higiene.*brincos?/i)
  })

  it('NÃO classifica flores preservadas como perecíveis', () => {
    const allText = pt.sections.map(s => s.body).join(' ')
    expect(allText).not.toMatch(/perec[ií]vel|perec[ií]veis/i)
  })

  it('refere falta de conformidade / 3 anos', () => {
    const section9 = pt.sections[8].body
    expect(section9).toMatch(/3\s*anos|três\s*anos/)
    expect(section9).toMatch(/falta de conformidade/)
  })

  it('formulário indica que o seu uso não é obrigatório', () => {
    expect(pt.modelFormNote).toMatch(/não é obrigatório/)
  })
})

describe('Middleware — /return-policy rewrite', () => {
  const middlewareContent = (() => {
    try {
      const fs = require('fs')
      const path = require('path')
      return fs.readFileSync(
        path.resolve(process.cwd(), 'src/middleware.ts'),
        'utf-8'
      )
    } catch {
      return ''
    }
  })()

  it('contém rewrite para /return-policy', () => {
    expect(middlewareContent).toContain("pathname === '/return-policy'")
    expect(middlewareContent).toContain('NextResponse.rewrite')
  })

  it('rewrite aponta para o defaultLocale', () => {
    expect(middlewareContent).toContain(`/${defaultLocale}/return-policy`)
  })

  it('não contém redirect no bloco do /return-policy', () => {
    const returnPolicyBlock = middlewareContent.split("pathname === '/return-policy'")[1]?.split('\n\n')[0] || ''
    expect(returnPolicyBlock).toContain('rewrite')
    expect(returnPolicyBlock).not.toContain('redirect')
  })
})

describe('SEO / Metadata', () => {
  it('PT canonical deve ser /return-policy', () => {
    const pageContent = (() => {
      try {
        const fs = require('fs')
        const path = require('path')
        return fs.readFileSync(
          path.resolve(process.cwd(), 'src/app/(frontend)/[locale]/return-policy/page.tsx'),
          'utf-8'
        )
      } catch {
        return ''
      }
    })()

    expect(pageContent).toContain("isPt ? `${siteUrl}/return-policy`")
  })

  it('x-default canonical aponta para /return-policy', () => {
    const pageContent = (() => {
      try {
        const fs = require('fs')
        const path = require('path')
        return fs.readFileSync(
          path.resolve(process.cwd(), 'src/app/(frontend)/[locale]/return-policy/page.tsx'),
          'utf-8'
        )
      } catch {
        return ''
      }
    })()

    expect(pageContent).toContain("x-default")
    expect(pageContent).toContain("return-policy")
  })
})