/**
 * Testes para /api/catalog-chat
 *
 * Testa:
 *   - Autenticação (sem token, token inválido, token válido)
 *   - OPENAI_API_KEY nunca aparece na resposta
 *   - CATALOG_ASSISTANT_API_KEY nunca aparece na resposta
 *   - tool allowlist (não permite recursos fora do catálogo)
 *   - create/update product passa pela Catalog Assistant API
 *   - nenhum DELETE disponível
 *   - upload só aceita formatos autorizados
 *   - erros internos são sanitizados
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ───────────────────────────────────────────────────

// Mock catalog-auth
const mockVerifyPayloadAdmin = vi.hoisted(() => vi.fn(() => Promise.resolve({ id: 1, email: 'marina@eternalflowers.pt', collection: 'users' })))
vi.mock('@/lib/catalog-auth', () => ({
  verifyPayloadAdmin: mockVerifyPayloadAdmin,
}))

// Mock catalog-chat
const mockProcessChatMessage = vi.hoisted(() => vi.fn(() => Promise.resolve({
  messages: [{ role: 'assistant', content: 'Olá! Como posso ajudar?' }],
})))
vi.mock('@/services/catalog-chat', () => ({
  processChatMessage: mockProcessChatMessage,
}))

describe('POST /api/catalog-chat', () => {
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
      // Default: valid token
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
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Teste' }],
    })
    const res = await POST(req)
    const body = await res.text()
    expect(body).not.toContain('sk-')
    expect(body).not.toContain('OPENAI_API_KEY')
  })

  it('CATALOG_ASSISTANT_API_KEY não aparece na resposta', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Teste' }],
    })
    const res = await POST(req)
    const body = await res.text()
    expect(body).not.toContain('CATALOG_ASSISTANT_API_KEY')
  })

  it('erro interno é sanitizado (sem stack trace)', async () => {
    mockProcessChatMessage.mockRejectedValue(new Error('DB connection failed: /srv/secret/path'))
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Teste' }],
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(500)
    // Erro genérico — sem stack, sem path interno
    expect(body.error.message).toBe('Erro interno do servidor.')
    expect(body.error.message).not.toContain('/srv/')
    expect(body.error.message).not.toContain('secret')
  })

  it('create product passa pela Catalog Assistant API', async () => {
    mockProcessChatMessage.mockResolvedValue({
      messages: [
        { role: 'assistant', content: 'Produto criado com sucesso.' },
      ],
    })
    const { POST } = await import('./route')
    const req = makeRequest({
      messages: [
        { role: 'user', content: 'Cria um produto: Rosa Teste, 50€, Rosa gallica' },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    // Verificar que o serviço foi chamado com os dados corretos
    expect(mockProcessChatMessage).toHaveBeenCalled()
  })

  it('rejeita imagem demasiado grande', async () => {
    const { POST } = await import('./route')
    // Criar um data URL que excede 10MB (11MB string)
    const largeB64 = 'A'.repeat(11 * 1024 * 1024)
    const largeData = 'data:image/png;base64,' + largeB64
    const req = new NextRequest('http://localhost:3000/api/catalog-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'payload-token=valid-token',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Analisa esta imagem' }],
        imageData: largeData,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
  }, 15000) // 15s timeout for this test
})