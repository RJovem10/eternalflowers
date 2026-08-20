/**
 * payload-config.test.ts — Regressão: handlers de fulfillment/cancel usam await import(), não require()
 *
 * Next.js 15 + Webpack 5 trata módulos com exportações async (c.a) como módulos async
 * que substituem module.exports por uma Promise. require() desses módulos devolve
 * a Promise, não o objeto exportado — destructuring produz undefined → TypeError.
 *
 * Estes módulos são importados com async import() nos handlers.
 * Este teste garante que não haja require() residual para os módulos de serviço
 * que são async.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.resolve(__dirname, './payload.config.ts')

describe('payload.config.ts — require() de módulos async', () => {
  const content = fs.readFileSync(CONFIG_PATH, 'utf-8')

  const asyncModules = [
    '@/services/order-fulfillment',
    '@/services/order-cancellation',
  ]

  for (const mod of asyncModules) {
    it(`não usa require('${mod}')`, () => {
      // Procurar require() para este módulo
      const requirePattern = new RegExp(
        `require\\s*\\(\\s*['"]${mod.replace(/\//g, '\\/')}['"]\\s*\\)`,
      )
      const requireMatch = content.match(requirePattern)
      expect(requireMatch, `${mod} ainda usa require() — deve usar await import()`).toBeNull()
    })

    it(`usa await import('${mod}')`, () => {
      const importPattern = new RegExp(
        `await\\s+import\\s*\\(\\s*['"]${mod.replace(/\//g, '\\/')}['"]\\s*\\)`,
      )
      const importMatch = content.match(importPattern)
      expect(importMatch, `${mod} não encontrado com await import()`).not.toBeNull()
    })
  }

  it('nenhum outro require() residual de módulos async de serviço', () => {
    // Extrair todos os require() que começam por '@/services/'
    const requireServicePattern = /require\s*\(\s*['"]@\/services\/([^'"]+)['"]\s*\)/g
    const matches = [...content.matchAll(requireServicePattern)]
    expect(matches, `require() residual para serviços: ${matches.map(m => m[0]).join(', ')}`).toHaveLength(0)
  })
})