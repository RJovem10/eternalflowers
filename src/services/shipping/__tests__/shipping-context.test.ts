/**
 * Testes unitários para shipping-context.ts — shipping context com valores fixos.
 *
 * O ShippingSettings Global foi removido (ISSUE-1T). A função
 * resolveShippingContext usa agora valores hardcoded para origin e pesos.
 *
 * Testa:
 * 1. Order standard → 500 g
 * 2. Order com cupula → 1000 g
 * 3. vários produtos standard → continua 500 g
 * 4. standard + cupula → 1000 g
 * 5. origin fixa (Braga)
 * 6. browser não controla peso/origin
 * 7. produtos sem shippingClass explícito → standard
 * 8. não são geradas dimensões fictícias
 * 9. parcel tem apenas weight
 */
import { describe, it, expect } from 'vitest'
import {
  resolveShippingContext,
  InvalidShippingWeightError,
} from '../shipping-context'

function makeOrder(items: Array<{ shippingClass?: string }> = []): any {
  return {
    items: items.map((item) => ({
      flower: { shippingClass: item.shippingClass || 'standard' },
    })),
  }
}

describe('resolveShippingContext (fixed values)', () => {
  it('1. Order standard → 500 g', async () => {
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext({} as any, order)
    expect(result.parcel.weight).toBe(0.5)
  })

  it('2. Order com cupula → 1000 g', async () => {
    const order = makeOrder([{ shippingClass: 'cupula' }])
    const result = await resolveShippingContext({} as any, order)
    expect(result.parcel.weight).toBe(1.0)
  })

  it('3. vários produtos standard → continua 500 g', async () => {
    const order = makeOrder([
      { shippingClass: 'standard' },
      { shippingClass: 'standard' },
      { shippingClass: 'standard' },
    ])
    const result = await resolveShippingContext({} as any, order)
    expect(result.parcel.weight).toBe(0.5)
  })

  it('4. standard + cupula → 1000 g', async () => {
    const order = makeOrder([
      { shippingClass: 'standard' },
      { shippingClass: 'cupula' },
    ])
    const result = await resolveShippingContext({} as any, order)
    expect(result.parcel.weight).toBe(1.0)
  })

  it('5. origin fixa (Braga)', async () => {
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext({} as any, order)
    expect(result.origin.recipientName).toBe('Eternal Flowers')
    expect(result.origin.city).toBe('Braga')
    expect(result.origin.country).toBe('PT')
    expect(result.origin.line1).toBe('Rua do Castelo, 123')
  })

  it('6. browser não controla peso/origin', async () => {
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext({} as any, order)
    // O resolver só usa valores fixos, nunca do browser
    expect(result.parcel.weight).toBe(0.5)
    expect(result.origin.recipientName).toBe('Eternal Flowers')
  })

  it('7. produtos sem shippingClass explícito → standard (500 g)', async () => {
    const order = {
      items: [
        { flower: 1, name: 'Rosa', price: 25, qty: 1 },
        { flower: { id: 2, namePt: 'Tulipa' }, name: 'Tulipa', price: 15, qty: 1 },
      ],
    }
    const result = await resolveShippingContext({} as any, order)
    expect(result.parcel.weight).toBe(0.5)
  })

  it('8. não são geradas dimensões fictícias', async () => {
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext({} as any, order)
    expect(result.parcel).not.toHaveProperty('length')
    expect(result.parcel).not.toHaveProperty('width')
    expect(result.parcel).not.toHaveProperty('height')
  })

  it('9. parcel tem apenas weight', async () => {
    const order = makeOrder([{ shippingClass: 'standard' }])
    const result = await resolveShippingContext({} as any, order)
    const keys = Object.keys(result.parcel)
    expect(keys).toEqual(['weight'])
  })
})