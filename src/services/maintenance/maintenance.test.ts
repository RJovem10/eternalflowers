/**
 * Testes para maintenance.ts — runner seguro de manutenção
 *
 * ISSUE-1T — 12+ cenários:
 *   1-4:  Auth (missing secret, missing header, wrong token, correct token)
 *   5:    Body não controla parâmetros
 *   6:    expireAbandonedPendingOrders executa antes do email processor
 *   7:    Erro em abandoned orders tratado explicitamente
 *   8:    Erro no email processor tratado explicitamente
 *   9:    Provider não configurado não consome retries
 *   10:   Duas chamadas simultâneas → segunda não corre
 *   11:   Lock é libertado mesmo após erro
 *   12:   Resposta não expõe PII/secrets/raw provider errors
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks de módulos ─────────────────────────────────────────

let mockAbandonedResult: any = { total: 2, expired: 1, skipped: 1, errors: 0, details: [] }
let mockAbandonedError: Error | null = null
const mockExpireFn = vi.fn()

vi.mock('@/services/order-lifecycle', () => ({
  expireAbandonedPendingOrders: vi.fn(async () => {
    mockExpireFn()
    if (mockAbandonedError) throw mockAbandonedError
    return mockAbandonedResult
  }),
}))

let mockEmailResult: any = { processed: 3, sent: 2, failed: 1, skipped: 0, errors: 0, details: [] }
let mockEmailError: Error | null = null
let mockEmailProviderNotConfigured = false
const mockEmailFn = vi.fn()

vi.mock('@/services/email/email-notifications', () => ({
  processPendingEmailNotifications: vi.fn(async () => {
    mockEmailFn()
    if (mockEmailError) throw mockEmailError
    return mockEmailResult
  }),
}))

vi.mock('@/services/email/get-email-provider', () => ({
  getConfiguredEmailProvider: vi.fn(async () => {
    if (mockEmailProviderNotConfigured) {
      const { EmailProviderNotConfiguredError } = await import('@/services/email/email-provider-errors')
      throw new EmailProviderNotConfiguredError('Email provider não configurado')
    }
    return { name: 'fake', send: vi.fn() }
  }),
}))

// Mock para payload.config (usado pelo endpoint)
vi.mock('@/payload.config', () => ({
  default: {},
}))

// Mock getPayload para evitar inicialização real do Payload nos testes de route
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ db: { name: 'sqlite' } })),
}))

const MAINTENANCE_ROUTE = '@/app/(payload)/api/internal/maintenance/route'

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function resetMocks() {
  mockAbandonedResult = { total: 2, expired: 1, skipped: 1, errors: 0, details: [] }
  mockAbandonedError = null
  mockEmailResult = { processed: 3, sent: 2, failed: 1, skipped: 0, errors: 0, details: [] }
  mockEmailError = null
  mockEmailProviderNotConfigured = false
  mockExpireFn.mockClear()
  mockEmailFn.mockClear()
  vi.clearAllMocks()
}

// ═══════════════════════════════════════════════════════════════
// 1-4: Auth tests (via route handler)
// ═══════════════════════════════════════════════════════════════

describe('Auth — POST /api/internal/maintenance', () => {
  const originalEnv = process.env

  beforeEach(() => {
    resetMocks()
    process.env = { ...originalEnv }
    process.env.MAINTENANCE_SECRET = 'test-secret-123'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('1. missing MAINTENANCE_SECRET → fail closed (503)', async () => {
    delete process.env.MAINTENANCE_SECRET

    const { POST } = await import(MAINTENANCE_ROUTE)

    const req = new NextRequest('http://localhost/api/internal/maintenance', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret-123' },
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('não configurada')
  })

  it('2. missing Authorization → unauthorized', async () => {
    const { POST } = await import(MAINTENANCE_ROUTE)

    const req = new NextRequest('http://localhost/api/internal/maintenance', {
      method: 'POST',
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Não autorizado.')
  })

  it('3. wrong token → unauthorized', async () => {
    const { POST } = await import(MAINTENANCE_ROUTE)

    const req = new NextRequest('http://localhost/api/internal/maintenance', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Não autorizado.')
  })

  it('4. correct token → maintenance executa', async () => {
    const { POST } = await import(MAINTENANCE_ROUTE)

    const req = new NextRequest('http://localhost/api/internal/maintenance', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret-123' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('abandonedOrders')
    expect(body).toHaveProperty('emailNotifications')
    expect(body.abandonedOrders.expired).toBe(1)
    expect(body.emailNotifications.sent).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════
// 5: Body não controla parâmetros
// ═══════════════════════════════════════════════════════════════

describe('Body — parâmetros não controláveis', () => {
  const originalEnv = process.env

  beforeEach(() => {
    resetMocks()
    process.env = { ...originalEnv }
    process.env.MAINTENANCE_SECRET = 'test-secret-123'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('5. body com recipientEmail é ignorado (não causa erro, só não é usado)', async () => {
    const { POST } = await import(MAINTENANCE_ROUTE)

    const req = new NextRequest('http://localhost/api/internal/maintenance', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-secret-123',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ recipientEmail: 'hacker@evil.com', provider: 'evil' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    // O body não deve ter causado erro — é ignorado
    const body = await res.json()
    expect(body).toHaveProperty('abandonedOrders')
    expect(body).toHaveProperty('emailNotifications')
  })
})

// ═══════════════════════════════════════════════════════════════
// 6-12: Service tests
// ═══════════════════════════════════════════════════════════════

describe('runMaintenanceCycle — service', () => {
  const mockPayload = { db: { name: 'sqlite' } } as any

  beforeEach(() => {
    resetMocks()
  })

  // ─── 6. Ordem ───────────────────────────────────────────────

  it('6. expireAbandonedPendingOrders executa antes do email processor', async () => {
    const { runMaintenanceCycle } = await import('./maintenance')

    // Garantir que não está locked
    const { isMaintenanceRunning } = await import('./maintenance')
    expect(isMaintenanceRunning()).toBe(false)

    await runMaintenanceCycle(mockPayload)

    // expired deve ter sido chamado primeiro
    expect(mockExpireFn).toHaveBeenCalledTimes(1)
    expect(mockEmailFn).toHaveBeenCalledTimes(1)

    // Verificar ordem: call order
    const expireCallOrder = mockExpireFn.mock.invocationCallOrder[0]
    const emailCallOrder = mockEmailFn.mock.invocationCallOrder[0]
    expect(expireCallOrder).toBeLessThan(emailCallOrder!)
  })

  // ─── 7. Erro abandoned orders ───────────────────────────────

  it('7. erro em expireAbandonedPendingOrders é tratado explicitamente', async () => {
    mockAbandonedError = new Error('DB connection lost')

    const { runMaintenanceCycle } = await import('./maintenance')

    const summary = await runMaintenanceCycle(mockPayload)

    // Abandoned orders reporta erro, email ainda corre
    expect(summary.abandonedOrders.errors).toBe(1)
    expect(summary.abandonedOrders.total).toBe(0)
    expect(summary.emailNotifications.sent).toBe(2)
    expect(mockEmailFn).toHaveBeenCalledTimes(1)
  })

  // ─── 8. Erro email processor ────────────────────────────────

  it('8. erro no email processor é tratado explicitamente', async () => {
    mockEmailError = new Error('SMTP connection refused')

    const { runMaintenanceCycle } = await import('./maintenance')

    const summary = await runMaintenanceCycle(mockPayload)

    // Abandoned orders correu bem, email reporta erro
    expect(summary.abandonedOrders.expired).toBe(1)
    expect(summary.emailNotifications.processed).toBe(0)
    expect(summary.emailNotifications.errors).toBe(1)
  })

  // ─── 9. Provider não configurado ────────────────────────────

  it('9. provider não configurado não consome retries indevidamente', async () => {
    mockEmailProviderNotConfigured = true

    const { runMaintenanceCycle } = await import('./maintenance')

    const summary = await runMaintenanceCycle(mockPayload)

    // Abandoned orders correu normalmente
    expect(summary.abandonedOrders.expired).toBe(1)

    // Email: providerNotConfigured=true, sem erros/sent/failed
    expect(summary.emailNotifications.providerNotConfigured).toBe(true)
    expect(summary.emailNotifications.processed).toBe(0)
    expect(summary.emailNotifications.sent).toBe(0)
    expect(summary.emailNotifications.errors).toBe(0)
    // processPendingEmailNotifications NÃO foi chamado (poupa retries)
    expect(mockEmailFn).not.toHaveBeenCalled()
  })

  // ─── 10. Concorrência ───────────────────────────────────────

  it('10. duas chamadas simultâneas → segunda não corre em paralelo', async () => {
    const { runMaintenanceCycle, isMaintenanceRunning } = await import('./maintenance')

    // Primeira chamada (simulamos que está a correr)
    const firstPromise = runMaintenanceCycle(mockPayload)

    // Tentar segunda — deve rejeitar
    await expect(
      runMaintenanceCycle(mockPayload),
    ).rejects.toThrow('já está em execução')

    // Aguardar primeira
    await firstPromise

    // Após a primeira, lock libertado — pode correr de novo
    expect(isMaintenanceRunning()).toBe(false)
    const secondSummary = await runMaintenanceCycle(mockPayload)
    expect(secondSummary.abandonedOrders.expired).toBe(1)
  })

  // ─── 11. Lock libertado após erro ───────────────────────────

  it('11. lock é libertado mesmo após erro', async () => {
    mockAbandonedError = new Error('Fatal error')

    const { runMaintenanceCycle, isMaintenanceRunning } = await import('./maintenance')

    // Primeira chamada com erro
    await runMaintenanceCycle(mockPayload)

    // Lock deve estar livre
    expect(isMaintenanceRunning()).toBe(false)

    // Segunda chamada deve funcionar
    mockAbandonedError = null
    const summary = await runMaintenanceCycle(mockPayload)
    expect(summary.abandonedOrders.expired).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// 12: Resposta não expõe PII/secrets
// ═══════════════════════════════════════════════════════════════

describe('Resposta sanitizada', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('12. resposta não expõe PII/secrets/raw provider errors', async () => {
    const { runMaintenanceCycle } = await import('./maintenance')

    const summary = await runMaintenanceCycle({
      db: { name: 'sqlite' },
    } as any)

    const json = JSON.stringify(summary)

    // Não deve conter PII
    expect(json).not.toContain('test@example.com')
    expect(json).not.toContain('+351')
    expect(json).not.toContain('Rua')

    // Não deve conter secrets
    expect(json).not.toContain('MAINTENANCE_SECRET')
    expect(json).not.toContain('sk_live')
    expect(json).not.toContain('pi_')

    // Não deve conter raw provider errors
    expect(json).not.toContain('SMTP')
    expect(json).not.toContain('Provider exception')

    // Não deve conter details individuais
    expect(json).not.toContain('details')
    expect(json).not.toContain('notificationId')
    expect(json).not.toContain('orderId')
  })
})