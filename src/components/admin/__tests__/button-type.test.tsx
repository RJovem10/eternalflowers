/**
 * @vitest-environment jsdom
 *
 * Testes para garantir que todos os <button> dos componentes Admin
 * têm type="button" explícito.
 *
 * CRÍTICO: Estes componentes são injetados em beforeDocumentControls
 * do Payload Admin, que está DENTRO de um <form>. Sem type="button"
 * explícito, o HTML assume type="submit" por omissão, causando
 * submissão involuntária do formulário Payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

// ─── Mocks @payloadcms/ui ──────────────────────────────────────

const mockUseDocumentInfo = vi.fn()
const mockUseFormFields = vi.fn()

vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => mockUseDocumentInfo(),
  useFormFields: (selector: Function) => mockUseFormFields(selector),
}))

// ─── Import após mocks ─────────────────────────────────────────

const { CancelOrderActions } = await import('../CancelOrderActions')
const { FulfillmentActions } = await import('../FulfillmentActions')

// ─── Helpers ───────────────────────────────────────────────────

function setupDocumentInfo(id: number | null) {
  mockUseDocumentInfo.mockReturnValue({ id })
}

function setupFormFields(orderStatus: string, paymentStatus: string, paymentProvider = 'stripe') {
  mockUseFormFields.mockImplementation((selector: Function) => {
    const fields = {
      orderStatus: { value: orderStatus },
      paymentStatus: { value: paymentStatus },
      paymentProvider: { value: paymentProvider },
    }
    return selector([fields, {}])
  })
}

/** Returns buttons that do NOT have type="button" */
function getButtonsMissingType(buttons: HTMLElement[]): HTMLElement[] {
  return buttons.filter((btn) => btn.getAttribute('type') !== 'button')
}

// ═══════════════════════════════════════════════════════════════
// CancelOrderActions
// ═══════════════════════════════════════════════════════════════

describe('CancelOrderActions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders "Cancelar e reembolsar" button with type="button" when confirmed+paid', () => {
    setupDocumentInfo(6)
    setupFormFields('confirmed', 'paid')

    render(<CancelOrderActions />)

    const btn = screen.getByRole('button')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Cancelar e reembolsar')
    expect(btn).toHaveAttribute('type', 'button')

    // No buttons without type="button"
    expect(getButtonsMissingType(screen.getAllByRole('button'))).toEqual([])
  })

  it('renders "Cancelar encomenda" button with type="button" when pending_payment', () => {
    setupDocumentInfo(6)
    setupFormFields('pending_payment', 'unpaid')

    render(<CancelOrderActions />)

    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Cancelar encomenda')
    expect(btn).toHaveAttribute('type', 'button')

    expect(getButtonsMissingType(screen.getAllByRole('button'))).toEqual([])
  })

  it('shows confirm modal with 3 buttons all type="button" when "Cancelar e reembolsar" is clicked', () => {
    setupDocumentInfo(6)
    setupFormFields('confirmed', 'paid')

    render(<CancelOrderActions />)

    // Click "Cancelar e reembolsar" to open modal
    fireEvent.click(screen.getByText('Cancelar e reembolsar'))

    // Modal should now show 3 buttons
    const allButtons = screen.getAllByRole('button')
    expect(allButtons.length).toBe(3)

    // All have type="button"
    expect(getButtonsMissingType(allButtons)).toEqual([])
  })

  it('manual paid exige confirmação externa e envia apenas confirmação/referência', async () => {
    setupDocumentInfo(6)
    setupFormFields('confirmed', 'paid', 'manual')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'resposta de teste' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CancelOrderActions />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar e registar reembolso externo' }))

    expect(screen.getByText(/não vai devolver dinheiro automaticamente/i)).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: 'Confirmar cancelamento' })
    expect(confirmButton).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Confirmo que o reembolso externo integral já foi efetuado.',
    }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Referência do reembolso (opcional)' }), {
      target: { value: '  REF-EXTERNA-42  ' },
    })
    expect(confirmButton).toBeEnabled()
    fireEvent.click(confirmButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/6/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manualRefund: { confirmed: true, reference: 'REF-EXTERNA-42' },
      }),
    })
    expect(getButtonsMissingType(screen.getAllByRole('button'))).toEqual([])
  })

  it('does not render when order is cancelled, expired, or processing', () => {
    for (const status of ['cancelled', 'expired', 'processing'] as const) {
      vi.clearAllMocks()
      setupDocumentInfo(6)
      setupFormFields(status, status === 'processing' ? 'paid' : 'refunded')

      const { container } = render(<CancelOrderActions />)
      expect(container.innerHTML).toBe('')
    }
  })

  it('does not render when id is null', () => {
    setupDocumentInfo(null)
    setupFormFields('confirmed', 'paid')

    const { container } = render(<CancelOrderActions />)
    expect(container.innerHTML).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════
// FulfillmentActions
// ═══════════════════════════════════════════════════════════════

describe('FulfillmentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Começar preparação" button with type="button" when confirmed+paid', () => {
    setupDocumentInfo(6)
    setupFormFields('confirmed', 'paid')

    render(<FulfillmentActions />)

    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Começar preparação')
    expect(btn).toHaveAttribute('type', 'button')

    expect(getButtonsMissingType(screen.getAllByRole('button'))).toEqual([])
  })

  it('renders "Marcar como expedida" with type="button" when processing+paid', () => {
    setupDocumentInfo(6)
    setupFormFields('processing', 'paid')

    render(<FulfillmentActions />)

    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Marcar como expedida')
    expect(btn).toHaveAttribute('type', 'button')

    expect(getButtonsMissingType(screen.getAllByRole('button'))).toEqual([])
  })

  it('renders "Marcar como concluída" with type="button" when shipped+paid', () => {
    setupDocumentInfo(6)
    setupFormFields('shipped', 'paid')

    render(<FulfillmentActions />)

    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('Marcar como concluída')
    expect(btn).toHaveAttribute('type', 'button')

    expect(getButtonsMissingType(screen.getAllByRole('button'))).toEqual([])
  })

  it('does not render when order is draft, cancelled, or no action', () => {
    for (const setup of [
      { status: 'draft', payment: 'unpaid' },
      { status: 'cancelled', payment: 'refunded' },
      { status: 'expired', payment: 'refunded' },
    ]) {
      vi.clearAllMocks()
      setupDocumentInfo(6)
      setupFormFields(setup.status, setup.payment)

      const { container } = render(<FulfillmentActions />)
      expect(container.innerHTML).toBe('')
    }
  })

  it('does not render when id is null', () => {
    setupDocumentInfo(null)
    setupFormFields('confirmed', 'paid')

    const { container } = render(<FulfillmentActions />)
    expect(container.innerHTML).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════
// CROSS-CHECK: every <button> in both components under all states
// has explicit type="button"
// ═══════════════════════════════════════════════════════════════

describe('Button type compliance — ZERO buttons without type="button"', () => {
  it('CancelOrderActions main + confirm modal all have type="button"', () => {
    setupDocumentInfo(6)
    setupFormFields('confirmed', 'paid')

    render(<CancelOrderActions />)

    // Open confirm modal
    fireEvent.click(screen.getByText('Cancelar e reembolsar'))

    const allButtons = screen.getAllByRole('button')
    expect(allButtons.length).toBe(3)

    const missing = getButtonsMissingType(allButtons)
    expect(missing).toEqual([])

    // Verify each individually too
    for (const btn of allButtons) {
      expect(btn).toHaveAttribute('type', 'button')
    }
  })

  it('FulfillmentActions — single button has type="button"', () => {
    setupDocumentInfo(6)
    setupFormFields('confirmed', 'paid')

    render(<FulfillmentActions />)

    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('type', 'button')
  })
})
