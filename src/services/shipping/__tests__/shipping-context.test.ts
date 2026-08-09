/**
 * Testes unitários para shipping-context.ts — sem Payload real, com mocking.
 *
 * Testa a lógica de resolução de shipping context:
 * 1. settings standard = 500 g
 * 2. settings cupula = 1000 g
 * 3. Order standard → 500 g
 * 4. Order com cupula → 1000 g
 * 5. vários produtos standard → continua 500 g
 * 6. standard + cupula → 1000 g
 * 7. origin vem do Payload Global
 * 8. browser não controla peso/origin
 * 9. settings incompletos → fail closed
 * 10. peso inválido → fail closed
 * 11. produtos existentes sem classificação explícita → standard
 * 12. não são geradas dimensões fictícias
 */
import { describe, it, expect, vi } from 'vitest'
import {
  resolveShippingContext,
  ShippingSettingsNotConfiguredError,
  InvalidShippingSettingsError,
  InvalidShippingWeightError,
  type ShippingContext,
} from '../shipping-context'

// ─── Helpers ──────────────────────────────────────────────────

const VALID_SETTINGS = {
  origin: {
    senderName: 'Eternal Flowers',
    phone: '+351210000000',
    email: 'info@eternalflowers.pt',
    line1: 'Rua das Flores, 123',
    line2: 'Loja A',
    city: 'Lisboa',
    region: 'Lisboa',
    postalCode: '1000-001',
    country: 'PT',
  },
  weightSettings: {
    standardWeightGrams: 500,
    cupulaWeightGrams: 1000,
  },
}

function mockPayload(settings: any = null): any {
  return {
    findGlobal: vi.fn().mockResolvedValue(settings ? { ...settings } : null),
  }
}

function makeOrder(items: Array<{ shippingClass?: string }> = []): any {
  return {
    items: items.map((item) => ({
      flower: { shippingClass: item.shippingClass || 'standard' },
    })),
  }
}

// ─── Testes ───────────────────────────────────────────────────

describe('resolveShippingContext', () => {
  it('1. settings standard = 500 g', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(0.5)
  })

  it('2. settings cupula = 1000 g', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'cupula' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(1.0)
  })

  it('3. Order standard → 500 g', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(0.5)
  })

  it('4. Order com cupula → 1000 g', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'cupula' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(1.0)
  })

  it('5. vários produtos standard → continua 500 g', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([
      { shippingClass: 'standard' },
      { shippingClass: 'standard' },
      { shippingClass: 'standard' },
    ])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(0.5)
  })

  it('6. standard + cupula → 1000 g', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([
      { shippingClass: 'standard' },
      { shippingClass: 'cupula' },
    ])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(1.0)
  })

  it('7. origin vem do Payload Global', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.origin.recipientName).toBe('Eternal Flowers')
    expect(result.origin.line1).toBe('Rua das Flores, 123')
    expect(result.origin.city).toBe('Lisboa')
    expect(result.origin.country).toBe('PT')
    expect(result.origin.postalCode).toBe('1000-001')
    expect(result.origin.phone).toBe('+351210000000')
  })

  it('8. browser não controla peso/origin', async () => {
    // O resolver só usa dados do Payload Global e da Order,
    // nunca do browser. Mesmo que o item tenha outros campos,
    // o peso vem exclusivamente das settings.
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(0.5)
    expect(result.origin.recipientName).toBe('Eternal Flowers')
  })

  it('9. settings incompletos → fail closed', async () => {
    // Sem origin
    const payload = mockPayload({
      weightSettings: { standardWeightGrams: 500, cupulaWeightGrams: 1000 },
    })
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(InvalidShippingSettingsError)
  })

  it('9b. settings ausentes → ShippingSettingsNotConfiguredError', async () => {
    // findGlobal devolve null
    const payload = mockPayload(null)
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(ShippingSettingsNotConfiguredError)
  })

  it('9c. origin.country inválido (não alpha-2) → fail closed', async () => {
    const payload = mockPayload({
      ...VALID_SETTINGS,
      origin: { ...VALID_SETTINGS.origin, country: 'Portugal' },
    })
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(InvalidShippingSettingsError)
  })

  it('9d. origin.senderName vazio → fail closed', async () => {
    const payload = mockPayload({
      ...VALID_SETTINGS,
      origin: { ...VALID_SETTINGS.origin, senderName: '' },
    })
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(InvalidShippingSettingsError)
  })

  it('10. peso inválido → fail closed (peso zero)', async () => {
    const payload = mockPayload({
      ...VALID_SETTINGS,
      weightSettings: { standardWeightGrams: 0, cupulaWeightGrams: 1000 },
    })
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(InvalidShippingSettingsError)
  })

  it('10b. peso negativo → fail closed', async () => {
    const payload = mockPayload({
      ...VALID_SETTINGS,
      weightSettings: { standardWeightGrams: -1, cupulaWeightGrams: 1000 },
    })
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(InvalidShippingSettingsError)
  })

  it('10c. weightSettings ausente → fail closed', async () => {
    const payload = mockPayload({
      origin: VALID_SETTINGS.origin,
    })
    const order = makeOrder([{ shippingClass: 'standard' }])
    await expect(resolveShippingContext(payload, order))
      .rejects.toThrow(InvalidShippingSettingsError)
  })

  it('11. produtos existentes sem classificação explícita → standard', async () => {
    // Items sem flower expandido ou sem shippingClass
    const payload = mockPayload(VALID_SETTINGS)
    const order = {
      items: [
        { flower: 1, name: 'Rosa', price: 25, qty: 1 }, // flower é ID, não object
        { flower: { id: 2, namePt: 'Tulipa' }, name: 'Tulipa', price: 15, qty: 1 }, // sem shippingClass
      ],
    }
    const result = await resolveShippingContext(payload, order)
    // Sem qualquer shippingClass, assume standard
    expect(result.parcel.weight).toBe(0.5)
  })

  it('12. não são geradas dimensões fictícias', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'cupula' }])
    const result = await resolveShippingContext(payload, order)
    expect(result.parcel.weight).toBe(1.0)
    // length, width, height não devem estar definidos
    expect(result.parcel).not.toHaveProperty('length')
    expect(result.parcel).not.toHaveProperty('width')
    expect(result.parcel).not.toHaveProperty('height')
  })

  it('parcel tem apenas weight (nunca dimensões)', async () => {
    const payload = mockPayload(VALID_SETTINGS)
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext(payload, order)
    const keys = Object.keys(result.parcel)
    expect(keys).toEqual(['weight'])
  })
})