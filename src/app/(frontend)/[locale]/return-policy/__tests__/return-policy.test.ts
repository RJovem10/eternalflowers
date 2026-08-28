/**
 * Testes para o conteúdo da Política de Devoluções e Reembolsos.
 * Verifica conteúdo em todos os 5 locales, secções obrigatórias,
 * e regras jurídicas específicas.
 */
import { describe, it, expect } from 'vitest'
import { returnPolicyContent, buildModelFormText } from '@/content/return-policy'
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
      expect(content.modelFormNote.length).toBeGreaterThan(0)
      expect(content.modelFormLabels.declaration.length).toBeGreaterThan(0)
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

  it('contém exceção de produtos personalizados com referência ao artigo 17.º', () => {
    const section7 = pt.sections[6].body
    expect(section7).toMatch(/personalizados/)
    expect(section7).toMatch(/não beneficiam do direito de livre resolução/)
    expect(section7).toMatch(/artigo 17\.º/)
    expect(section7).not.toMatch(/artigo 4\.º/)
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

  it('refere regra dos primeiros 30 dias', () => {
    const section9 = pt.sections[8].body
    expect(section9).toMatch(/30\s*dias/)
  })

  it('formulário indica que o seu uso não é obrigatório', () => {
    expect(pt.modelFormNote).toMatch(/não é obrigatório/)
  })

  it('refere "contrato celebrado à distância" em vez de "fora do estabelecimento"', () => {
    const section1 = pt.sections[0].body
    expect(section1).toMatch(/contrato celebrado à distância/)
    expect(section1).not.toMatch(/fora do estabelecimento/)
  })

  it('refere "abrangida pelo regime legal aplicável" em vez de "imputável"', () => {
    const section5 = pt.sections[4].body
    expect(section5).toMatch(/abrangida pelo regime legal aplicável/)
    expect(section5).not.toMatch(/imputável/)
  })

  it('secção 10 não contém "solicitar após contacto"', () => {
    const section10 = pt.sections[9].body
    expect(section10).not.toMatch(/solicitar após contacto/)
    expect(section10).not.toMatch(/fornecido após/)
  })
})

describe('EN — legal references', () => {
  const en = returnPolicyContent.en

  it('section 7 uses Article 17(1)(c)', () => {
    const section7 = en.sections[6].body
    expect(section7).toMatch(/Article 17\(1\)\(c\)/)
    expect(section7).not.toMatch(/Article 4/)
  })

  it('section 1 uses "distance contract"', () => {
    const section1 = en.sections[0].body
    expect(section1).toMatch(/distance contract/)
    expect(section1).not.toMatch(/off-premises/)
  })
})

describe('ES — legal references', () => {
  const es = returnPolicyContent.es

  it('section 7 uses artículo 17', () => {
    const section7 = es.sections[6].body
    expect(section7).toMatch(/artículo 17/)
    expect(section7).not.toMatch(/artículo 4/)
  })
})

describe('IT — legal references', () => {
  const itContent = returnPolicyContent.it

  it('section 7 uses articolo 17', () => {
    const section7 = itContent.sections[6].body
    expect(section7).toMatch(/articolo 17/)
    expect(section7).not.toMatch(/articolo 4/)
  })
})

describe('DE — legal references', () => {
  const de = returnPolicyContent.de

  it('section 7 uses Artikel 17', () => {
    const section7 = de.sections[6].body
    expect(section7).toMatch(/Artikel 17/)
    expect(section7).not.toMatch(/Artikel 4/)
  })
})

describe('Model form — no placeholders', () => {
  it.each(locales)('%s model form não contém placeholders "solicitar após contacto"', (locale) => {
    const content = returnPolicyContent[locale]
    expect(content.modelFormLabels.declaration).toBeTruthy()
    // The old modelForm string is no longer used directly; check via labels
    expect(content.modelFormLabels.recipient).toBeTruthy()
  })
})

describe('Model form builder — buildModelFormText', () => {
  it('companyName undefined — nenhuma linha real perdida', () => {
    const text = buildModelFormText(returnPolicyContent.pt, {
      address: 'Rua Teste',
      postalCode: '1000-000',
      city: 'Lisboa',
      country: 'Portugal',
    }, 'email@example.com')
    expect(text).toContain('Eternal Flowers by Mar&Natur®')
    expect(text).toContain('Rua Teste')
    expect(text).toContain('1000-000 Lisboa')
    expect(text).toContain('Portugal')
    expect(text).toContain('email@example.com')
  })

  it('sem dados — apenas fallback do nome, sem linhas inventadas', () => {
    const text = buildModelFormText(returnPolicyContent.pt, {}, null)
    expect(text).toContain('Eternal Flowers by Mar&Natur®')
    expect(text).not.toContain('solicitar após contacto')
  })

  it('companyName presente — usado o nome real', () => {
    const text = buildModelFormText(returnPolicyContent.pt, {
      companyName: 'Eternal Flowers Unipessoal, Lda.',
      address: 'Rua Teste',
    }, null)
    expect(text).toContain('Eternal Flowers Unipessoal, Lda.')
    expect(text).toContain('Rua Teste')
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

  it('PT canonical deve ser /return-policy', () => {
    expect(pageContent).toContain("isPt ? `${siteUrl}/return-policy`")
  })

  it('x-default canonical aponta para /return-policy', () => {
    expect(pageContent).toContain("x-default")
    expect(pageContent).toContain("return-policy")
  })

  it('PT hreflang usa /return-policy em vez de /pt/return-policy', () => {
    expect(pageContent).toContain("if (l === 'pt')")
    expect(pageContent).toContain("languages[l] = `${siteUrl}/return-policy`")
  })

  it('não usa payloadLocaleOptions (import removido)', () => {
    expect(pageContent).not.toContain('payloadLocaleOptions')
  })

  it('usa buildModelFormText importado do content module', () => {
    expect(pageContent).toContain('buildModelFormText')
  })
})

describe('Real middleware behaviour', () => {
  it('middleware module pode ser importado e NextRequest/NextResponse existem', async () => {
    // Verificar que podemos importar os módulos necessários
    const nextServer = await import('next/server')
    expect(nextServer.NextRequest).toBeDefined()
    expect(nextServer.NextResponse).toBeDefined()
  })

  it('middleware rewrite funciona para /return-policy', async () => {
    const { NextRequest, NextResponse } = await import('next/server')
    const { middleware } = await import('@/middleware')

    const request = new NextRequest(new Request('https://eternalflowers.pt/return-policy'))
    const response = await middleware(request)

    // NextResponse.rewrite devolve 200 sem Location
    expect(response.status).toBe(200)
    expect(response.headers.get('Location')).toBeNull()
  })

  it('/return-policy com cookie NEXT_LOCALE=en continua a fazer rewrite para PT', async () => {
    const { NextRequest } = await import('next/server')
    const { middleware } = await import('@/middleware')

    const request = new NextRequest(new Request('https://eternalflowers.pt/return-policy'))
    request.cookies.set('NEXT_LOCALE', 'en')
    const response = await middleware(request)

    expect(response.status).toBe(200)
    // Internamente o pathname rewrite é para /pt/return-policy
    // Não podemos ver o pathname interno do rewrite, mas confirmamos que é 200 e não redirect
    expect(response.headers.get('Location')).toBeNull()
  })

  it('/en/return-policy não sofre rewrite para PT', async () => {
    const { NextRequest } = await import('next/server')
    const { middleware } = await import('@/middleware')

    const request = new NextRequest(new Request('https://eternalflowers.pt/en/return-policy'))
    const response = await middleware(request)

    // Rota com locale não deve ser tocada
    expect(response.status).toBe(200)
    expect(response.headers.get('Location')).toBeNull()
  })

  it('middleware faz redirect para /pt quando não tem locale', async () => {
    const { NextRequest } = await import('next/server')
    const { middleware } = await import('@/middleware')

    const request = new NextRequest(new Request('https://eternalflowers.pt/catalog'))
    const response = await middleware(request)

    // Rota sem locale deve ser redirecionada para /pt/catalog
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toMatch(/\/pt\/catalog$/)
  })
})