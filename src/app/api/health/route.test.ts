/**
 * Testes para GET /api/health
 *
 * Testa:
 *   - 200 com DB disponível
 *   - 503 com DB indisponível
 *   - resposta sanitizada (sem detalhes internos)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────

const mockCount = vi.fn()
const mockGetPayload = vi.fn()

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    getPayload: mockGetPayload,
  }
})

// ─── Tests ──────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devolve 200 quando DB está disponível', async () => {
    mockGetPayload.mockResolvedValue({ count: mockCount })
    mockCount.mockResolvedValue({ totalDocs: 0 })

    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })

  it('devolve 503 quando getPayload lança erro', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB connection refused'))

    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ status: 'error' })
  })

  it('devolve 503 quando count falha', async () => {
    mockGetPayload.mockResolvedValue({ count: mockCount })
    mockCount.mockRejectedValue(new Error('query timeout'))

    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ status: 'error' })
  })

  it('resposta não expõe detalhes internos', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB connection refused'))

    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    // Deve conter APENAS o campo status
    expect(Object.keys(body)).toEqual(['status'])
    // NÃO deve conter error, stack, env, version, etc.
    expect(body).not.toHaveProperty('error')
    expect(body).not.toHaveProperty('stack')
    expect(body).not.toHaveProperty('env')
    expect(body).not.toHaveProperty('version')
  })
})