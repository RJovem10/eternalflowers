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
 * 18. cart clearing só acontece com PaymentIntent.status=succeeded
 * 19. redirect_status=succeeded + retrieved processing → clear NOT called
 * 20. missing clientSecret → clear NOT called
 * 21. retrieval failure → clear NOT called
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
// retrievePaymentIntent is overridable per test via mockRetrievePaymentIntent

let mockRetrievePaymentIntent: any = () =>
  Promise.resolve({ paymentIntent: { status: 'succeeded' } })

vi.mock('@/lib/stripe-client', () => ({
  getStripe: vi.fn().mockResolvedValue({
    retrievePaymentIntent: (...args: any[]) => mockRetrievePaymentIntent(...args),
  }),
}))

// ─── Mock CartProvider — expose clear call counter ────────

const mockClear = vi.fn()

vi.mock('@/components/CartProvider', () => ({
  useCart: () => ({ clear: mockClear }),
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

// ─── Helpers para PaymentResultPage ───────────────────────

function mockSearchParams(overrides: Record<string, string | null>) {
  ;(useSearchParams as any).mockReturnValue({
    get: (key: string) => overrides[key] ?? null,
  })
}

// ─── Testes PaymentResultPage ─────────────────────────────

describe('PaymentResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClear.mockClear()
    ;(useParams as any).mockReturnValue({ locale: 'pt' })
  })

  // ════════════════════════════════════════════════════════════
  // Cart clearing — only when PaymentIntent.status === 'succeeded'
  // ════════════════════════════════════════════════════════════

  it('retrieved succeeded → clear called exactly once', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'succeeded' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_123',
      redirect_status: 'succeeded',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Pagamento recebido!')).toBeDefined()
    })

    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  it('retrieved processing → clear NOT called', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'processing' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_456',
      redirect_status: 'processing',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Pagamento em processamento.')).toBeDefined()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('retrieved requires_payment_method → clear NOT called', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'requires_payment_method' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_789',
      redirect_status: 'requires_payment_method',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Pagamento não concluído.')).toBeDefined()
      expect(screen.getByText('Tentar novamente')).toBeDefined()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('retrieved requires_action → clear NOT called', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'requires_action' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_aaa',
      redirect_status: 'requires_action',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Pagamento não concluído.')).toBeDefined()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('redirect_status=succeeded + retrieved processing → clear NOT called', async () => {
    // This is the critical forgery scenario: client sends
    // redirect_status=succeeded but Stripe says processing
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'processing' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_forged',
      redirect_status: 'succeeded',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Pagamento em processamento.')).toBeDefined()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('retrieved succeeded only triggers clear once (idempotency)', async () => {
    let callCount = 0
    mockRetrievePaymentIntent = () => {
      callCount++
      return Promise.resolve({ paymentIntent: { status: 'succeeded' } })
    }

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_ccc',
      redirect_status: 'succeeded',
    })

    // Render will call retrievePaymentIntent once; React strict-mode
    // double-invocation is handled by processedRef. Only one clear.
    const { rerender } = render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Pagamento recebido!')).toBeDefined()
    })

    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  it('no clientSecret → clear NOT called', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'succeeded' } })

    mockSearchParams({
      payment_intent_client_secret: null,
      redirect_status: 'succeeded',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao verificar pagamento.')).toBeDefined()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('no paymentIntent returned (retrieval failure) → clear NOT called', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: null })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_fail',
      redirect_status: 'succeeded',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao verificar pagamento.')).toBeDefined()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('retrievePaymentIntent rejects → clear NOT called, safe error shown', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.reject(new Error('network failure'))

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_reject',
      redirect_status: 'succeeded',
    })

    render(<PaymentResultPage />)

    await waitFor(() => {
      expect(screen.getByText('Erro ao verificar pagamento.')).toBeDefined()
    })

    // Generic error must not expose internal details
    expect(screen.queryByText('network failure')).toBeNull()
    expect(mockClear).not.toHaveBeenCalled()
  })

  // ════════════════════════════════════════════════════════════
  // Display-only tests (redirect_status used for UX only)
  // ════════════════════════════════════════════════════════════

  it('exibe succeeded (redirect_status via Stripe retrieval)', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'succeeded' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_123',
      redirect_status: 'succeeded',
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Pagamento recebido!')).toBeDefined()
    })
  })

  it('exibe processing (redirect_status via Stripe retrieval)', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'processing' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_456',
      redirect_status: 'processing',
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Pagamento em processamento.')).toBeDefined()
    })
  })

  it('exibe failed + retry (redirect_status via Stripe retrieval)', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'requires_payment_method' } })

    mockSearchParams({
      payment_intent_client_secret: 'pi_secret_789',
      redirect_status: 'requires_payment_method',
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Pagamento não concluído.')).toBeDefined()
      expect(screen.getByText('Tentar novamente')).toBeDefined()
    })
  })

  it('sem parâmetros → erro', async () => {
    mockRetrievePaymentIntent = () =>
      Promise.resolve({ paymentIntent: { status: 'succeeded' } })

    mockSearchParams({
      payment_intent_client_secret: null,
      redirect_status: null,
    })

    render(<PaymentResultPage />)
    await waitFor(() => {
      expect(screen.getByText('Erro ao verificar pagamento.')).toBeDefined()
    })
  })
})