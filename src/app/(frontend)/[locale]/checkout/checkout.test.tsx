// @vitest-environment jsdom
/**
 * Testes para a página de checkout (guest checkout frontend).
 *
 * Testa formulário completo, idempotência, erros, i18n, e
 * comportamento de sucesso sem limpar carrinho.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import CheckoutPage from './page'

// ─── Mocks ──────────────────────────────────────────────────

const mockUseParams = vi.fn()
const mockUseCart = vi.fn()
const mockGetDictionary = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}))

vi.mock('@/components/CartProvider', () => ({
  useCart: () => mockUseCart(),
}))

vi.mock('@/i18n/dictionaries', () => ({
  getDictionary: (l: string) => mockGetDictionary(l),
}))

// ─── Dict base ──────────────────────────────────────────────

const BASE_DICT: Record<string, string> = {
  brand: 'Flores Marina',
  cart: 'Carrinho',
  checkout: 'Finalizar',
  addToCart: 'Adicionar',
  subtotal: 'Subtotal',
  total: 'Total',
  coupon: 'Cupão',
  email: 'Email',
  emailPlaceholder: 'teu@email.com',
  name: 'Nome',
  namePlaceholder: 'O teu nome',
  completeOrder: 'Finalizar encomenda',
  emptyCart: 'O carrinho está vazio.',
  backToCart: 'Voltar ao carrinho',
  required: 'Campo obrigatório.',
  orderError: 'Erro ao finalizar a encomenda.',
  processing: 'A processar…',
  phone: 'Telefone',
  companyName: 'Empresa',
  taxId: 'NIF / VAT',
  recipientName: 'Destinatário',
  addressLine1: 'Morada',
  addressLine2: 'Complemento',
  city: 'Cidade',
  region: 'Distrito / Região',
  postalCode: 'Código Postal',
  country: 'País',
  selectCountry: 'Selecionar país',
  billingSameAsShipping: 'Morada de faturação igual à de entrega',
  checkoutReceived: 'Dados recebidos!',
  orderNumberLabel: 'N.º de Encomenda',
  checkoutNextStep: 'O cálculo de portes e continuação do checkout será o próximo passo.',
  checkoutConflict: 'Esta tentativa já foi usada com dados diferentes. Tenta novamente.',
  checkoutServerError: 'Erro interno do servidor. Tenta novamente.',
  customerInfo: 'Cliente',
  shippingInfo: 'Morada de Entrega',
  billingInfo: 'Morada de Faturação',
  continueShopping: 'Continuar a comprar',
  invalidCoupon: 'Cupão inválido ou expirado.',
}

const EN_DICT: Record<string, string> = {
  ...BASE_DICT,
  checkout: 'Checkout',
  emptyCart: 'Your cart is empty.',
  completeOrder: 'Complete order',
  customerInfo: 'Customer',
  shippingInfo: 'Shipping Address',
  billingSameAsShipping: 'Billing address same as shipping',
  checkoutReceived: 'Data received!',
  checkoutConflict: 'This attempt was already used with different data.',
  checkoutServerError: 'Internal server error.',
  backToCart: 'Back to cart',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  recipientName: 'Recipient',
  addressLine1: 'Address',
  city: 'City',
  country: 'Country',
  billingInfo: 'Billing Address',
  subtotal: 'Subtotal',
  coupon: 'Coupon',
}

// ─── Helpers ────────────────────────────────────────────────

const MOCK_ITEMS = [
  { id: '1', name: 'Rosa Vermelha', price: 25.5, qty: 2 },
  { id: '2', name: 'Lírio Branco', price: 18.0, qty: 1 },
]

function fillForm(dict = BASE_DICT) {
  // Telefone appears in both customer and shipping sections — pick first (customer)
  const phoneInputs = screen.getAllByLabelText(new RegExp(dict.phone))
  fireEvent.change(phoneInputs[0], { target: { value: '+351912345678' } })

  fireEvent.change(screen.getByLabelText(new RegExp(dict.name)), { target: { value: 'João Silva' } })
  fireEvent.change(screen.getByLabelText(new RegExp(dict.email)), { target: { value: 'joao@example.com' } })
  fireEvent.change(screen.getByLabelText(new RegExp(dict.recipientName)), { target: { value: 'João Silva' } })
  // Use getByRole to avoid matching checkbox label (billingSameAsShipping contains "Morada")
  fireEvent.change(screen.getByRole('textbox', { name: /Morada/ }), { target: { value: 'Rua das Flores, 123' } })
  fireEvent.change(screen.getByLabelText(new RegExp(dict.city)), { target: { value: 'Lisboa' } })
  fireEvent.change(screen.getByLabelText(new RegExp(dict.country)), { target: { value: 'PT' } })
}

let fetchCalls: { url: string; body: any }[] = []

let cryptoUuidCounter = 0

function renderCheckout(locale = 'pt') {
  mockUseParams.mockReturnValue({ locale })
  mockGetDictionary.mockImplementation((l: string) => (l === 'en' ? EN_DICT : BASE_DICT))
  return render(<CheckoutPage />)
}

// ─── Tests ──────────────────────────────────────────────────

describe('Checkout Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    fetchCalls = []
    cryptoUuidCounter = 0
    // Re-stub fetch padrão
    vi.stubGlobal('fetch', vi.fn((_url: string, opts: any) => {
      const body = opts?.body ? JSON.parse(opts.body) : null
      fetchCalls.push({ url: _url, body })
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            ok: true,
            orderId: 42,
            orderNumber: 'EF-2026-ABCD',
            subtotal: 69,
            discount: 0,
            shippingCost: null,
            total: null,
            orderStatus: 'draft',
            paymentStatus: 'unpaid',
          }),
      })
    }))
    vi.stubGlobal('crypto', {
      ...crypto,
      randomUUID: () => `uuid-${++cryptoUuidCounter}`,
    })
  })

  // ── 1. Render do formulário ──────────────────────────────

  it('1. mostra mensagem de carrinho vazio quando count=0', () => {
    mockUseCart.mockReturnValue({ items: [], count: 0, coupon: null })
    const { container } = renderCheckout()
    expect(container.textContent).toContain('O carrinho está vazio.')
  })

  it('1b. renderiza formulário quando há items', () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    expect(screen.getByText('Finalizar')).toBeInTheDocument()
    expect(screen.getByText(/Rosa Vermelha/)).toBeInTheDocument()
    expect(screen.getByText(/Lírio Branco/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Telefone/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText(/Destinatário/)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Morada/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText(/Cidade/)).toBeInTheDocument()
    expect(screen.getByLabelText(/País/)).toBeInTheDocument()
  })

  // ── 2. Billing igual/diferente ──────────────────────────

  it('2. checkbox billingSame default true, billing hidden', () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    const checkbox = screen.getByLabelText('Morada de faturação igual à de entrega')
    expect(checkbox).toBeChecked()
    expect(screen.queryByText('Morada de Faturação')).not.toBeInTheDocument()
  })

  it('2b. desmarcar checkbox mostra formulário de faturação', () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    const checkbox = screen.getByLabelText('Morada de faturação igual à de entrega')
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    expect(screen.getByText('Morada de Faturação')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Destinatário/)).toHaveLength(2)
  })

  it('2c. re-marcar checkbox esconde billing', () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    const checkbox = screen.getByLabelText('Morada de faturação igual à de entrega')
    fireEvent.click(checkbox)
    expect(screen.getByText('Morada de Faturação')).toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(screen.queryByText('Morada de Faturação')).not.toBeInTheDocument()
  })

  // ── 3. Payload contém apenas flowerId + qty ────────────

  it('3. items no payload têm apenas flowerId + qty', async () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()
    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(0))

    const body = fetchCalls[0].body
    expect(body.items).toHaveLength(2)
    body.items.forEach((item: any) => {
      expect(item).toHaveProperty('flowerId')
      expect(item).toHaveProperty('qty')
      expect(item).not.toHaveProperty('price')
      expect(item).not.toHaveProperty('name')
      expect(item).not.toHaveProperty('subtotal')
    })
    expect(body.items[0]).toEqual({ flowerId: 1, qty: 2 })
    expect(body.items[1]).toEqual({ flowerId: 2, qty: 1 })
  })

  // ── 4. Country é ISO alpha-2 ───────────────────────────

  it('4. country no payload é PT (ISO alpha-2)', async () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()
    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(0))

    expect(fetchCalls[0].body.shippingAddress.country).toBe('PT')
  })

  // ── 5. Double submit bloqueado ─────────────────────────

  it('5. botão fica desativado durante submit', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()

    fireEvent.click(screen.getByText('Finalizar encomenda'))
    await waitFor(() => expect(screen.getByText('A processar…')).toBeInTheDocument())
    expect(screen.getByText('A processar…').closest('button')).toBeDisabled()
  })

  // ── 6. Retry reutiliza checkoutRequestId ───────────────

  it('6. duas submissões sem alteração usam mesmo checkoutRequestId', async () => {
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts: any) => {
        callCount++
        const isFirst = callCount === 1
        const body = opts?.body ? JSON.parse(opts.body) : null
        fetchCalls.push({ url: _url, body })
        return Promise.resolve({
          ok: !isFirst,
          status: isFirst ? 409 : 201,
          json: () =>
            Promise.resolve(
              isFirst
                ? { ok: false, error_code: 'IDEMPOTENCY_CONFLICT', error: 'Conflict' }
                : { ok: true, orderId: 42, orderNumber: 'EF-2026-ABCD', subtotal: 69, discount: 0, shippingCost: null, total: null, orderStatus: 'draft', paymentStatus: 'unpaid' },
            ),
        })
      }),
    )

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()

    const btn = screen.getByText('Finalizar encomenda')

    fireEvent.click(btn)
    await waitFor(() => expect(fetchCalls.length).toBe(1))

    fireEvent.click(btn)
    await waitFor(() => expect(fetchCalls.length).toBe(2))

    expect(fetchCalls[0].body.checkoutRequestId).toBe(fetchCalls[1].body.checkoutRequestId)
  })

  // ── 7. Alteração material gera nova tentativa ─────────

  it('7. alterar email entre submissões gera novo checkoutRequestId', async () => {
    // Primeiro submit falha (409) para manter o formulário visível
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts: any) => {
        callCount++
        const isFirst = callCount === 1
        const body = opts?.body ? JSON.parse(opts.body) : null
        fetchCalls.push({ url: _url, body })
        return Promise.resolve({
          ok: !isFirst,
          status: isFirst ? 409 : 201,
          json: () =>
            Promise.resolve(
              isFirst
                ? { ok: false, error_code: 'IDEMPOTENCY_CONFLICT', error: 'Conflict' }
                : { ok: true, orderId: 42, orderNumber: 'EF-2026-ABCD', subtotal: 69, discount: 0, shippingCost: null, total: null, orderStatus: 'draft', paymentStatus: 'unpaid' },
            ),
        })
      }),
    )

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()

    const btn = screen.getByText('Finalizar encomenda')

    fireEvent.click(btn)
    await waitFor(() => expect(fetchCalls.length).toBe(1))
    const firstId = fetchCalls[0].body.checkoutRequestId

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'outro@example.com' } })

    fireEvent.click(btn)
    await waitFor(() => expect(fetchCalls.length).toBe(2))

    expect(fetchCalls[1].body.checkoutRequestId).not.toBe(firstId)
  })

  // ── 8. Success não limpa carrinho ─────────────────────

  it('8. sucesso não limpa carrinho (clear não é chamada)', async () => {
    const clearMock = vi.fn()
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null, clear: clearMock })
    renderCheckout()
    fillForm()

    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() => expect(screen.getByText('Dados recebidos!')).toBeInTheDocument())
    expect(clearMock).not.toHaveBeenCalled()
    expect(screen.getByText(/EF-2026-ABCD/)).toBeInTheDocument()
    expect(
      screen.getByText('O cálculo de portes e continuação do checkout será o próximo passo.'),
    ).toBeInTheDocument()
  })

  // ── 9. 400/409/500 tratados ───────────────────────────

  it('9a. 400 validation error mostra mensagem da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false, status: 400,
          json: () => Promise.resolve({ ok: false, error: 'Nome do cliente é obrigatório.', error_code: 'ORDER_VALIDATION_ERROR' }),
        }),
      ),
    )

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()
    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() => expect(screen.getByText('Nome do cliente é obrigatório.')).toBeInTheDocument())
  })

  it('9b. 409 idempotency conflict mostra checkoutConflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false, status: 409,
          json: () => Promise.resolve({ ok: false, error: 'Conflito.', error_code: 'IDEMPOTENCY_CONFLICT' }),
        }),
      ),
    )

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()
    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() =>
      expect(
        screen.getByText('Esta tentativa já foi usada com dados diferentes. Tenta novamente.'),
      ).toBeInTheDocument(),
    )
  })

  it('9c. 500 internal error mostra checkoutServerError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false, status: 500,
          json: () => Promise.resolve({ ok: false, error: 'Erro interno.', error_code: 'INTERNAL_ERROR' }),
        }),
      ),
    )

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()
    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() =>
      expect(screen.getByText('Erro interno do servidor. Tenta novamente.')).toBeInTheDocument(),
    )
  })

  it('9d. network error mostra checkoutServerError', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))))

    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout()
    fillForm()
    fireEvent.click(screen.getByText('Finalizar encomenda'))

    await waitFor(() =>
      expect(screen.getByText('Erro interno do servidor. Tenta novamente.')).toBeInTheDocument(),
    )
  })

  // ── 10. Locales funcionam ─────────────────────────────

  it('10. locale en usa dicionário inglês', () => {
    mockUseCart.mockReturnValue({ items: MOCK_ITEMS, count: 3, coupon: null })
    renderCheckout('en')
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('Customer')).toBeInTheDocument()
    expect(screen.getByText('Shipping Address')).toBeInTheDocument()
    expect(screen.getByText('Complete order')).toBeInTheDocument()
  })
})