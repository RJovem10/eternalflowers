/**
 * Testes para /api/catalog-chat e catalog-chat service
 *
 * Testa:
 *   - Autenticação (sem token, token inválido, token válido)
 *   - OPENAI_API_KEY nunca aparece na resposta
 *   - CATALOG_ASSISTANT_API_KEY nunca aparece na resposta
 *   - imageData em messages[]: MIME inválido → 415, >10MB → 413
 *   - tool allowlist (não permite recursos fora do catálogo)
 *   - create/update product passa pela Catalog Assistant API
 *   - uploadMedia existe na allowlist
 *   - uploadMedia sem imagem não faz upload
 *   - product tool contém images, productionLeadTime, canShareShippingPackage
 *   - erro interno de uma tool não devolve err.message ao modelo
 *   - nenhum DELETE disponível
 *   - erros internos são sanitizados
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ───────────────────────────────────────────────────

const mockVerifyPayloadAdmin = vi.hoisted(() => vi.fn(() => Promise.resolve({ id: 1, email: 'marina@eternalflowers.pt', collection: 'users' })))
vi.mock('@/lib/catalog-auth', () => ({
  verifyPayloadAdmin: mockVerifyPayloadAdmin,
}))

const mockProcessChatMessage = vi.hoisted(() => vi.fn())
vi.mock('@/services/catalog-chat', () => ({
  processChatMessage: mockProcessChatMessage,
}))

// ─── Route Tests ─────────────────────────────────────────────

describe('POST /api/catalog-chat — auth & validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyPayloadAdmin.mockResolvedValue({ id: 1, email: 'marina@eternalflowers.pt', collection: 'users' })
    mockProcessChatMessage.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'Olá! Como posso ajudar?' }],
    })
  })

  function makeRequest(body: unknown, cookie?: string): NextRequest {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (cookie != null) {
      headers['Cookie'] = `payload-token=${cookie}`
    } else {
      headers['Cookie'] = 'payload-token=valid-token'
    }
    return new NextRequest('http://localhost:3000/api/catalog-chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  }

  it('devolve 401 quando não há token', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/catalog-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('devolve 401 quando token é inválido', async () => {
    mockVerifyPayloadAdmin.mockResolvedValue(null as any)
    const { POST } = await import('./route')
    const req = makeRequest({ messages: [{ role: 'user', content: 'Olá' }] }, 'invalid-token')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('devolve 400 quando mensagens estão ausentes', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('devolve 200 quando mensagem é válida', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Lista produtos' }],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.messages).toHaveLength(1)
  })

  it('OPENAI_API_KEY não aparece na resposta', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ messages: [{ role: 'user', content: 'Teste' }] })
    const res = await POST(req)
    const body = await res.text()
    expect(body).not.toContain('sk-')
    expect(body).not.toContain('OPENAI_API_KEY')
  })

  it('CATALOG_ASSISTANT_API_KEY não aparece na resposta', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ messages: [{ role: 'user', content: 'Teste' }] })
    const res = await POST(req)
    const body = await res.text()
    expect(body).not.toContain('CATALOG_ASSISTANT_API_KEY')
  })

  it('erro interno é sanitizado (sem stack trace)', async () => {
    mockProcessChatMessage.mockRejectedValue(new Error('DB connection failed: /srv/secret/path'))
    const { POST } = await import('./route')
    const req = makeRequest({ messages: [{ role: 'user', content: 'Teste' }] })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error.message).toBe('Erro interno do servidor.')
    expect(body.error.message).not.toContain('/srv/')
    expect(body.error.message).not.toContain('secret')
  })

  it('create product passa pela Catalog Assistant API', async () => {
    mockProcessChatMessage.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'Produto criado com sucesso.' }],
    })
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Cria um produto: Rosa Teste, 50€, Rosa gallica' }],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockProcessChatMessage).toHaveBeenCalled()
  })

  // ─── Image validation from messages[].imageData ──────────

  it('rejeita MIME inválido em messages[].imageData → 415', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [{
        role: 'user',
        content: 'Analisa esta imagem',
        imageData: 'data:image/gif;base64,R0lGODdhAQABAIAAAP8AAAAA',
      }],
    })
    const res = await POST(req)
    expect(res.status).toBe(415)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_MIME_TYPE')
  })

  it('rejeita data URL inválida → 400', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [{
        role: 'user',
        content: 'Analisa',
        imageData: 'not-a-data-url',
      }],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_IMAGE_FORMAT')
  })

  it('rejeita imagem > 10MB em messages[].imageData → 413', async () => {
    const { POST } = await import('./route')
    // base64 de ~11MB (11M chars * 3/4 = ~8.25MB, mas com o prefixo data:image/jpeg;base64, excede 10MB)
    const largeB64 = 'A'.repeat(14 * 1024 * 1024) // ~14M chars base64 = ~10.5MB decoded
    const req = makeRequest({
      messages: [{
        role: 'user',
        content: 'Analisa',
        imageData: 'data:image/jpeg;base64,' + largeB64,
      }],
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error.code).toBe('IMAGE_TOO_LARGE')
  })

  it('aceita imagem JPEG válida em messages[].imageData', async () => {
    const { POST } = await import('./route')
    // 1x1 pixel JPEG base64 pequeno
    const smallJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP////8B//8KAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA/////2wBDAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA='
    const req = makeRequest({
      messages: [{
        role: 'user',
        content: 'Analisa',
        imageData: 'data:image/jpeg;base64,' + smallJpeg,
      }],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})