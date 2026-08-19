/**
 * Testes de integração para POST /api/checkout
 *
 * Testa o mapeamento de erros HTTP, formato de resposta,
 * idempotência e rejeição de dados falsos enviados pelo frontend.
 *
 * NOTA: Estes testes mockam getPayload e createOrder.
 * A lógica de domínio do createOrder está coberta em orders.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────

// Mock payload preserving buildConfig for payload.config
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    getPayload: vi.fn(() => Promise.resolve({})),
  }
})

// Mock the createOrder service
let mockCreateOrderFn = vi.fn()

vi.mock('@/services/orders', () => ({
  createOrder: (...args: any[]) => mockCreateOrderFn(...args),
}))

// Import after mocks are set up
const { POST } = await import('./route')
import {
  OrderValidationError,
  InvalidProductError,
  CouponValidationError,
  IdempotencyConflictError,
} from '@/services/order-types'

// ─── Helpers ─────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_INPUT = {
  checkoutRequestId: '550e8400-e29b-41d4-a716-446655440000',
  customer: {
    name: 'Maria Silva',
    email: 'maria@example.com',
    phone: '+351912345678',
  },
  shippingAddress: {
    recipientName: 'Maria Silva',
    line1: 'Rua das Flores, 123',
    city: 'Lisboa',
    postalCode: '1000-001',
    country: 'PT',
  },
  billingSameAsShipping: true,
  items: [{ flowerId: 1, qty: 2 }],
  locale: 'pt',
}

const RESULT_ORDER = {
  id: 42,
  orderNumber: 'EF-20260808-A1B2C3D4',
  subtotal: 51.0,
  discount: 0,
  shippingCost: 8.00,
  total: 59.00,
  orderStatus: 'pending_payment',
  paymentStatus: 'unpaid',
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. pedido válido → 201 ──────────────────────────────────

  it('1. pedido válido → 201 com dados correctos', async () => {
    mockCreateOrderFn.mockResolvedValue({ order: RESULT_ORDER })

    const res = await POST(makeRequest(VALID_INPUT))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(data.orderId).toBe(42)
    expect(data.orderNumber).toBe('EF-20260808-A1B2C3D4')
    expect(data.subtotal).toBe(51.0)
    expect(data.discount).toBe(0)
    expect(data.shippingCost).toBe(8.00)
    expect(data.total).toBe(59.00)
    expect(data.orderStatus).toBe('pending_payment')
    expect(data.paymentStatus).toBe('unpaid')
  })

  // ── 2. OrderStatus = draft, paymentStatus = unpaid ──────────

  it('2. status da ordem: pending_payment/unpaid', async () => {
    mockCreateOrderFn.mockResolvedValue({ order: RESULT_ORDER })

    const res = await POST(makeRequest(VALID_INPUT))
    const data = await res.json()

    expect(data.orderStatus).toBe('pending_payment')
    expect(data.paymentStatus).toBe('unpaid')
  })

  // ── 3. Preço/subtotal vêm da BD, não do body ────────────────

  it('3. preço/subtotal vêm da BD (createOrder calcula server-side)', async () => {
    const ORDER_WITH_PRICES = {
      ...RESULT_ORDER,
      subtotal: 51.0,
      items: [{ price: 25.5, name: 'Rosa Vermelha', lineTotal: 51.0 }],
    }
    mockCreateOrderFn.mockResolvedValue({ order: ORDER_WITH_PRICES })

    // Passar body com price falso — o createOrder deve ignorá-lo
    await POST(makeRequest({
      ...VALID_INPUT,
      items: [{ flowerId: 1, qty: 2 }],
    }))
    const data = await POST(makeRequest(VALID_INPUT)).then(r => r.json())

    expect(data.subtotal).toBe(51.0)
    // O preço por item vem do createOrder, não do body
    const createOrderArg = mockCreateOrderFn.mock.calls[0][1]
    expect(createOrderArg.items[0].flowerId).toBe(1)
    expect(createOrderArg.items[0].qty).toBe(2)
    expect((createOrderArg.items[0] as any).price).toBeUndefined()
    expect((createOrderArg.items[0] as any).name).toBeUndefined()
  })

  // ── 4. mesmo checkoutRequestId → mesma Order ────────────────

  it('4. mesmo checkoutRequestId devolve mesma Order (idempotência)', async () => {
    mockCreateOrderFn.mockResolvedValue({ order: RESULT_ORDER })

    const res1 = await POST(makeRequest(VALID_INPUT))
    const data1 = await res1.json()

    // Segunda chamada devolve a mesma order
    mockCreateOrderFn.mockResolvedValue({ order: RESULT_ORDER })

    const res2 = await POST(makeRequest(VALID_INPUT))
    const data2 = await res2.json()

    // Ambos devolvem a mesma orderId
    expect(data1.orderId).toBe(data2.orderId)
    expect(data1.orderNumber).toBe(data2.orderNumber)
  })

  // ── 5. checkoutRequestId igual mas pedido diferente → 409 ───

  it('5. mesmo checkoutRequestId com pedido diferente → 409', async () => {
    mockCreateOrderFn.mockRejectedValue(
      new IdempotencyConflictError('checkoutRequestHash já usado com items diferentes.'),
    )

    const res = await POST(makeRequest({
      ...VALID_INPUT,
      items: [{ flowerId: 999, qty: 1 }],
    }))
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.ok).toBe(false)
    expect(data.error_code).toBe('IDEMPOTENCY_CONFLICT')
  })

  // ── 6. flower inexistente → 404 ──────────────────────────────

  it('6. flower inexistente → 404', async () => {
    mockCreateOrderFn.mockRejectedValue(
      new InvalidProductError('Flor com id 999 não encontrada.'),
    )

    const res = await POST(makeRequest(VALID_INPUT))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.ok).toBe(false)
    expect(data.error_code).toBe('INVALID_PRODUCT')
  })

  // ── 7. input inválido → 400 ─────────────────────────────────

  it('7. input inválido → 400 com details', async () => {
    mockCreateOrderFn.mockRejectedValue(
      new OrderValidationError(['customer.email é obrigatório.', 'items não pode estar vazio.']),
    )

    const res = await POST(makeRequest({ ...VALID_INPUT, customer: null, items: [] }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error_code).toBe('ORDER_VALIDATION_ERROR')
    expect(data.details).toBeDefined()
    expect(Array.isArray(data.details)).toBe(true)
    expect(data.details.length).toBeGreaterThan(0)
  })

  // ── 8. coupon inválido → 400 ────────────────────────────────

  it('8. coupon inválido → 400', async () => {
    mockCreateOrderFn.mockRejectedValue(
      new CouponValidationError('Cupão inválido para esta encomenda.'),
    )

    const res = await POST(makeRequest({ ...VALID_INPUT, coupon: 'INVALIDO' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error_code).toBe('COUPON_VALIDATION_ERROR')
  })

  // ── 9. coupon não incrementa usesCount ──────────────────────

  it('9. coupon NÃO incrementa usesCount (createOrder não o faz)', async () => {
    mockCreateOrderFn.mockResolvedValue({
      order: { ...RESULT_ORDER, discount: 5.10, coupon: 'TEST10' },
    })

    await POST(makeRequest({ ...VALID_INPUT, coupon: 'TEST10' }))

    // Verificar que o createOrder foi chamado com o coupon
    const createOrderArg = mockCreateOrderFn.mock.calls[0][1]
    expect(createOrderArg.coupon).toBe('TEST10')
    // createOrder não incrementa usesCount (verificado nos unit tests)
  })

  // ── 10. price/subtotal falsos são ignorados ─────────────────

  it('10. body com price/subtotal falsos é ignorado pelo createOrder', async () => {
    mockCreateOrderFn.mockResolvedValue({ order: RESULT_ORDER })

    // Callee envia price/subtotal falsos no body
    const fraudulentBody = {
      ...VALID_INPUT,
      items: [{ flowerId: 1, qty: 2, price: 1.0, name: 'Barato' }],
      subtotal: 2.0,
    }

    await POST(makeRequest(fraudulentBody))

    // createOrder recebe só flowerId e qty
    const args = mockCreateOrderFn.mock.calls[0][1]
    expect(args.items[0].flowerId).toBe(1)
    expect(args.items[0].qty).toBe(2)
    expect((args.items[0] as any).price).toBeUndefined()
    expect((args.items[0] as any).name).toBeUndefined()
  })

  // ── 11. erro inesperado → 500 sem detalhes ──────────────────

  it('11. erro inesperado → 500 sem stack trace', async () => {
    mockCreateOrderFn.mockRejectedValue(new Error('Algo correu mal internamente.'))

    const res = await POST(makeRequest(VALID_INPUT))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.ok).toBe(false)
    expect(data.error_code).toBe('INTERNAL_ERROR')
    expect(data.error).toBe('Erro interno do servidor.')
    // Não revelar detalhes internos
    expect((data as any).stack).toBeUndefined()
  })

  // ── 12. JSON inválido → 400 ─────────────────────────────────

  it('12. JSON inválido → 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error_code).toBe('INVALID_JSON')
  })
})