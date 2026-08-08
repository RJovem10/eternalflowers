/**
 * Testes unitários para shipping.ts + providers/ctt.ts
 *
 * Testa validação de input, normalização, tratamento de erros
 * e comportamento do CttShippingProvider stub.
 *
 * Sem mock de Payload nem de base de dados — tudo isolado.
 */
import { describe, it, expect, vi } from 'vitest'
import { getShippingQuotes, type ShippingProvider } from '../shipping'
import { cttProvider } from '../providers/ctt'
import {
  InvalidShippingInputError,
  ShippingProviderNotConfiguredError,
  ShippingProviderError,
  type ShippingQuoteInput,
  type ShippingQuote,
} from '../shipping-types'

// ─── Helpers ──────────────────────────────────────────────────

function validInput(overrides: Partial<ShippingQuoteInput> = {}): ShippingQuoteInput {
  return {
    origin: {
      recipientName: 'Eternal Flowers',
      line1: 'Rua das Flores, 123',
      city: 'Lisboa',
      country: 'PT',
    },
    destination: {
      recipientName: 'Maria Silva',
      line1: 'Av. da Liberdade, 456',
      city: 'Porto',
      country: 'PT',
    },
    parcels: [{ weight: 1.5 }],
    currency: 'EUR',
    ...overrides,
  }
}

function makeMockProvider(quotes: ShippingQuote[]): ShippingProvider {
  const mockQuote = vi.fn(async () => quotes)
  return { id: 'mock', quote: mockQuote }
}

function makeFailingMockProvider(error: Error): ShippingProvider {
  const mockQuote = vi.fn(async () => { throw error })
  return { id: 'failing-mock', quote: mockQuote }
}

const validQuote: ShippingQuote = {
  provider: 'mock',
  serviceCode: 'STANDARD',
  serviceName: 'Standard Delivery',
  amount: 7.90,
  currency: 'EUR',
  estimatedMinDays: 2,
  estimatedMaxDays: 4,
}

// ─── Testes ───────────────────────────────────────────────────

describe('getShippingQuotes', () => {
  it('1. aceita um quote válido', async () => {
    const provider = makeMockProvider([validQuote])
    const result = await getShippingQuotes(provider, validInput())
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(7.90)
    expect(result[0].serviceCode).toBe('STANDARD')
  })

  it('2. provider recebe input correcto', async () => {
    const mockQuote = vi.fn(async () => [validQuote])
    const provider: ShippingProvider = { id: 'mock', quote: mockQuote }
    const input = validInput()
    await getShippingQuotes(provider, input)
    expect(mockQuote).toHaveBeenCalledTimes(1)
    const input0 = (mockQuote as any).mock.calls[0][0]
    expect(input0.currency).toBe('EUR')
    expect(input0.parcels).toHaveLength(1)
  })

  it('3a. amount negativo é rejeitado', async () => {
    const provider = makeMockProvider([
      { ...validQuote, amount: -5 },
    ])
    await expect(getShippingQuotes(provider, validInput())).rejects.toThrow(ShippingProviderError)
  })

  it('3b. amount zero é aceite (pode ser promoção/grátis)', async () => {
    const provider = makeMockProvider([
      { ...validQuote, amount: 0 },
    ])
    const result = await getShippingQuotes(provider, validInput())
    expect(result[0].amount).toBe(0)
  })

  it('4a. currency inválida no input é rejeitada', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({ currency: 'XYZ' })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('4b. provider sem serviceCode é rejeitado', async () => {
    const provider = makeMockProvider([
      { ...validQuote, serviceCode: '' },
    ])
    await expect(getShippingQuotes(provider, validInput())).rejects.toThrow(ShippingProviderError)
  })

  it('4c. provider sem serviceName é rejeitado', async () => {
    const provider = makeMockProvider([
      { ...validQuote, serviceName: '' },
    ])
    await expect(getShippingQuotes(provider, validInput())).rejects.toThrow(ShippingProviderError)
  })

  it('5. CttShippingProvider sem configuração lança ShippingProviderNotConfiguredError', async () => {
    expect(cttProvider.id).toBe('ctt')
    // Directamente no provider
    await expect(cttProvider.quote(validInput())).rejects.toThrow(ShippingProviderNotConfiguredError)
    // Através de getShippingQuotes — o erro propaga sem ser embrulhado
    await expect(
      getShippingQuotes(cttProvider, validInput()),
    ).rejects.toThrow(ShippingProviderNotConfiguredError)
  })

  it('6. erros do provider são tratados sem expor detalhes internos', async () => {
    const provider = makeFailingMockProvider(new Error('Timeout na API'))
    try {
      await getShippingQuotes(provider, validInput())
      expect.fail('Deveria ter lançado erro')
    } catch (err) {
      expect(err).toBeInstanceOf(ShippingProviderError)
      expect((err as Error).message).not.toContain('Timeout')
      expect((err as Error).message).toContain('failing-mock')
    }
  })

  it('7a. country normalizado/validado (minúsculas rejeitadas)', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({
        origin: {
          ...validInput().origin,
          country: 'pt',
        },
      })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('7b. currency normalizada para uppercase', async () => {
    const mockQuote = vi.fn(async () => [validQuote])
    const provider: ShippingProvider = { id: 'mock', quote: mockQuote }
    await getShippingQuotes(provider, validInput({ currency: 'eur' }))
    // A normalização acontece antes de passar ao provider
    const input0 = (mockQuote as any).mock.calls[0][0]
    expect(input0.currency).toBe('EUR')
  })

  it('origin sem country rejeitado', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({
        origin: { ...validInput().origin, country: '' },
      })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('destination sem city rejeitado', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({
        destination: { ...validInput().destination, city: '' },
      })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('parcels vazio rejeitado', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({ parcels: [] })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('parcel com weight 0 rejeitado', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({
        parcels: [{ weight: 0 }],
      })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('parcel com weight negativo rejeitado', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({
        parcels: [{ weight: -1 }],
      })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('orderValue negativo rejeitado', async () => {
    await expect(
      getShippingQuotes(makeMockProvider([validQuote]), validInput({
        orderValue: -10,
      })),
    ).rejects.toThrow(InvalidShippingInputError)
  })

  it('múltiplos erros de validação reportados', async () => {
    try {
      await getShippingQuotes(makeMockProvider([validQuote]), {} as any)
      expect.fail('Deveria ter lançado erro')
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidShippingInputError)
      const typed = err as InvalidShippingInputError
      expect(typed.details.length).toBeGreaterThan(1)
    }
  })

  it('quote com estimatedMinDays > estimatedMaxDays rejeitado', async () => {
    const provider = makeMockProvider([
      { ...validQuote, estimatedMinDays: 5, estimatedMaxDays: 3 },
    ])
    await expect(getShippingQuotes(provider, validInput())).rejects.toThrow(ShippingProviderError)
  })

  it('provider que devolve não-array é rejeitado', async () => {
    const mockQuote = vi.fn(async () => null as any)
    const provider: ShippingProvider = { id: 'bad-mock', quote: mockQuote }
    await expect(getShippingQuotes(provider, validInput())).rejects.toThrow(ShippingProviderError)
  })

  it('currency EUR é aceite', async () => {
    const provider = makeMockProvider([validQuote])
    const result = await getShippingQuotes(provider, validInput({ currency: 'EUR' }))
    expect(result).toHaveLength(1)
  })

  it('currency USD é aceite', async () => {
    const provider = makeMockProvider([{ ...validQuote, currency: 'USD' }])
    const result = await getShippingQuotes(provider, validInput({ currency: 'USD' }))
    expect(result).toHaveLength(1)
    expect(result[0].currency).toBe('USD')
  })

  it('currency do quote não corresponde ao input → rejeitado', async () => {
    // Provider devolve USD quando input é EUR
    const provider = makeMockProvider([{ ...validQuote, currency: 'USD' }])
    await expect(getShippingQuotes(provider, validInput({ currency: 'EUR' }))).rejects.toThrow(ShippingProviderError)
  })
})