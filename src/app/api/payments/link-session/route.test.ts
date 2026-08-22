import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createPaymentSessionFromLink: vi.fn(),
  getPayload: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getPayload: mocks.getPayload,
}))

vi.mock('@/services/payments/payment-links', () => {
  class PaymentLinkError extends Error {
    constructor(
      public code: 'PAYMENT_LINK_INVALID' | 'PAYMENT_LINK_NOT_ALLOWED' | 'PAYMENT_LINK_EXPIRED',
      message: string,
    ) {
      super(message)
      this.name = 'PaymentLinkError'
    }
  }
  return {
    createPaymentSessionFromLink: mocks.createPaymentSessionFromLink,
    PaymentLinkError,
  }
})

const { POST } = await import('./route')
const { PaymentLinkError } = await import('@/services/payments/payment-links')

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_1'

function request(body: unknown): NextRequest {
  return new NextRequest('https://shop.example.test/api/payments/link-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/payments/link-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({ id: 'payload' })
    mocks.createPaymentSessionFromLink.mockResolvedValue({ clientSecret: 'pi_server_secret' })
  })

  it.each(['amount', 'currency', 'total', 'shippingCost', 'orderId']) (
    'L: rejects browser-controlled financial/order field %s before loading Payload',
    async (field) => {
      const response = await POST(request({ token: TOKEN, [field]: field === 'currency' ? 'USD' : 0.01 }))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        error: 'O pedido contém campos não permitidos.',
      })
      expect(mocks.getPayload).not.toHaveBeenCalled()
      expect(mocks.createPaymentSessionFromLink).not.toHaveBeenCalled()
    },
  )

  it('K/L: accepts only the opaque token and returns privacy-preserving response headers', async () => {
    const response = await POST(request({ token: `  ${TOKEN}  ` }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ clientSecret: 'pi_server_secret' })
    expect(mocks.createPaymentSessionFromLink).toHaveBeenCalledWith({ id: 'payload' }, TOKEN)
    expect(response.headers.get('cache-control')).toBe('no-store, private')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it.each([
    ['PAYMENT_LINK_INVALID', 404],
    ['PAYMENT_LINK_NOT_ALLOWED', 409],
    ['PAYMENT_LINK_EXPIRED', 410],
  ] as const)('maps secure link error %s to HTTP %s without leaking order data', async (code, status) => {
    mocks.createPaymentSessionFromLink.mockRejectedValue(
      new PaymentLinkError(code, 'Link indisponível.'),
    )

    const response = await POST(request({ token: TOKEN }))
    const data = await response.json()
    expect(response.status).toBe(status)
    expect(data).toEqual({ error: 'Link indisponível.', code })
    expect(data).not.toHaveProperty('orderId')
    expect(data).not.toHaveProperty('total')
  })

  it('rejects malformed JSON without touching payment services', async () => {
    const malformed = new NextRequest('https://shop.example.test/api/payments/link-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    })

    const response = await POST(malformed)
    expect(response.status).toBe(400)
    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(mocks.createPaymentSessionFromLink).not.toHaveBeenCalled()
  })
})
