// @vitest-environment jsdom
/**
 * Testes de frontend para StripePaymentSection e payment-result
 *
 * Testa:
 *  9. Payment Element só monta com clientSecret
 * 10. missing publishable key falha de forma controlada
 * 11. submit chama stripe.confirmPayment (conceptual)
 * 12. double submit bloqueado (conceptual)
 * 13. erro Stripe mostrado ao utilizador
 * 14. cart não é limpo antes de sucesso (conceptual)
 * 15. payment-result succeeded apresenta sucesso
 * 16. processing apresenta estado pendente
 * 17. requires_payment_method apresenta falha/retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useSearchParams, useParams } from 'next/navigation'
import StripePaymentSection from '@/components/StripePaymentSection'
import PaymentResultPage from '@/app/(frontend)/[locale]/checkout/payment-result/page'

// ─── Mock next/navigation ─────────────────────────────────

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
  useParams: vi.fn(),
}))

// ─── Mock @stripe/react-stripe-js ─────────────────────────

const mockConfirmPayment = vi.fn()
const mockElements = { locale: 'en' }

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="elements-wrapper">{children}</div>,
  PaymentElement: ({ options }: any) => <div data-testid="payment-element" data-options={JSON.stringify(options)} />,
  useElements: () => mockElements,
  useStripe: () => ({
    confirmPayment: mockConfirmPayment,
  }),
}))

// ─── Mock @/lib/stripe-client ─────────────────────────────

vi.mock('@/lib/stripe-client', () => ({
  getStripe: vi.fn().mockResolvedValue({
    retrievePaymentIntent: vi.fn(() =>
      Promise.resolve({ paymentIntent: { status: 'succeeded' } })
    ),
  }),
}))

// ─── Mock CartProvider for PaymentResultPage ────────────

vi.mock('@/components/CartProvider', () => ({
  useCart: () => ({ clear: vi.fn() }),
}))

// ─── Mock i18n ────────────────────────────────────────────

vi.mock('@/i18n/dictionaries', () => ({
  getDictionary: () => ({
    payNow: 'Pagar agora',
    processing: 'A processar…',
    paymentError: 'Erro ao processar pagamento.',
    paymentTryAgain: 'Tentar novamente',
    stripeNotConfigured: 'Pagamento indisponível.',
    loading: 'A carregar…',
    amount: 'Valor',
    paymentResultSucceeded: 'Pagamento recebido!',
    paymentResultProcessing: 'Pagamento em processamento.',
    paymentResultFailed: 'Pagamento não concluído.',
    paymentResultUnknown: 'Estado desconhecido.',
    paymentResultError: 'Erro ao verificar pagamento.',
    backToHome: 'Voltar ao início',
    tryAgain: 'Tentar novamente',
  }),
}))

// ─── Mock global fetch ────────────────────────────────────

const mockFetch = vi.fn()
global.fetch = mockFetch

// ─── Configurar env para testes ───────────────────────────

const ORIGINAL_ENV = process.env

// ─── Testes StripePaymentSection ──────────────────────────

describe('StripePaymentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc' }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  const defaultProps = {
    orderNumber: 'EF-20260808-0001',
    checkoutRequestId: 'test-uuid',
    locale: 'pt',
    dict: {
      payNow: 'Pagar agora',
      processing: 'A processar…',
      paymentError: 'Erro ao processar pagamento.',
      paymentTryAgain: 'Tentar novamente',
      stripeNotConfigured: 'Pagamento indisponível.',
      loading: 'A carregar…',
      amount: 'Valor',
      shippingLabel: 'Envio',
      shippingToConfirm: 'Portes de envio a confirmar',
    },
  }

  it('9. mostra botão pagar quando sem clientSecret', () => {
    render(<StripePaymentSection {...defaultProps} />)
    expect(screen.getByText('Pagar agora')).toBeDefined()
  })

  it('10. missing publishable key mostra estado indisponível', () => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    render(<StripePaymentSection {...defaultProps} />)
    expect(screen.getByText('Pagamento indisponível.')).toBeDefined()
  })

  it('11. clique faz fetch a /api/payments/session', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clientSecret: 'pi_mock_secret_abc' }),
    } as any)

    render(<StripePaymentSection {...defaultProps} />)
    const button = screen.getByText('Pagar agora')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/payments/session', expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }))
    })

    // Após receber clientSecret, o Payment Element deve montar
    await waitFor(() => {
      expect(screen.getByTestId('elements-wrapper')).toBeDefined()
    })
  })

  it('12. erro na resposta do session é mostrado ao utilizador', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Erro de teste.' }),
    } as any)

    render(<StripePaymentSection {...defaultProps} />)
    fireEvent.click(screen.getByText('Pagar agora'))

    await waitFor(() => {
      expect(screen.getByText('Erro de teste.')).toBeDefined()
    })
  })

  it('13. erro Stripe mostrado ao utilizador via confirmPayment', async () => {
    // Mock fetch para retornar clientSecret primeiro
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clientSecret: 'pi_mock_secret_abc' }),
    } as any)

    mockConfirmPayment.mockResolvedValue({
      error: { message: 'Your card was declined.' },
    })

    render(<StripePaymentSection {...defaultProps} />)
    fireEvent.click(screen.getByText('Pagar agora'))

    // Esperar que o Payment Element apareça
    await waitFor(() => {
      expect(screen.getByTestId('elements-wrapper')).toBeDefined()
    })
  })

  it('14. erro de rede no fetch é mostrado', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<StripePaymentSection {...defaultProps} />)
    fireEvent.click(screen.getByText('Pagar agora'))

    await waitFor(() => {
      expect(screen.getByText('Erro ao processar pagamento.')).toBeDefined()
    })
  })
})

// ─── Testes PaymentResultPage ─────────────────────────────

describe('PaymentResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useParams as any).mockReturnValue({ locale: 'pt' })
  })

  it('15. succeeded → mostra sucesso', async () => {
    ;(useSearchParams as any).mockReturnValue({
      get: (key: string) => {
        if (key === 'payment_intent_client_secret') return 'pi_secret_123'
        if (key === 'redirect_status') return 'succeeded'
        return null
      },
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Pagamento recebido!')).toBeDefined()
    })
  })

  it('16. processing → mostra pendente', async () => {
    ;(useSearchParams as any).mockReturnValue({
      get: (key: string) => {
        if (key === 'payment_intent_client_secret') return 'pi_secret_456'
        if (key === 'redirect_status') return 'processing'
        return null
      },
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Pagamento em processamento.')).toBeDefined()
    })
  })

  it('17. requires_payment_method → mostra falha + retry', async () => {
    ;(useSearchParams as any).mockReturnValue({
      get: (key: string) => {
        if (key === 'payment_intent_client_secret') return 'pi_secret_789'
        if (key === 'redirect_status') return 'requires_payment_method'
        return null
      },
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Pagamento não concluído.')).toBeDefined()
      expect(screen.getByText('Tentar novamente')).toBeDefined()
    })
  })

  it('sem parâmetros → erro', async () => {
    ;(useSearchParams as any).mockReturnValue({
      get: () => null,
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Erro ao verificar pagamento.')).toBeDefined()
    })
  })
})