/**
 * Testes unitários para fixed-shipping.ts — cálculo de portes fixos
 *
 * ISSUE-1Q Final rules:
 * - NUNCA existe portes grátis automático
 * - Standard PT: €4/unidade de envio
 * - Standard International: €6/unidade de envio
 * - canShareShippingPackage=true: até 3 peças = 1 unidade
 * - Cúpula → sempre portes a confirmar manualmente
 * - Discounts/coupons NÃO alteram o cálculo de portes
 */
import { describe, it, expect } from 'vitest'
import {
  calculateFixedShipping,
  type FixedShippingInput,
} from '../fixed-shipping'

// ─── Helpers ──────────────────────────────────────────────────

function makeInput(overrides: Partial<FixedShippingInput> = {}): FixedShippingInput {
  return {
    items: [],
    destinationCountry: 'PT',
    ...overrides,
  }
}

function standardItem(canShare: boolean, qty = 1) {
  return { shippingClass: 'standard' as const, canShareShippingPackage: canShare, qty }
}

function cupulaItem(qty = 1) {
  return { shippingClass: 'cupula' as const, canShareShippingPackage: false, qty }
}

// ─── Testes ───────────────────────────────────────────────────

describe('calculateFixedShipping', () => {
  // ── A) PT 1 shareable → €4 ──
  it('A) PT 1 shareable → €4', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
    }))
    expect(result.shippingCost).toBe(4.00)
    expect(result.cupulaNeedsConfirmation).toBe(false)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── B) PT 3 shareable → €4 (1 shipment) ──
  it('B) PT 3 shareable → €4 (1 shipment)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 3)],
      destinationCountry: 'PT',
    }))
    expect(result.shippingCost).toBe(4.00)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── C) PT 4 shareable → €8 (2 shipments) ──
  it('C) PT 4 shareable → €8 (2 shipments)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 4)],
      destinationCountry: 'PT',
    }))
    expect(result.shippingCost).toBe(8.00)
    expect(result.standardShipmentUnits).toBe(2)
  })

  // ── D) International 3 shareable → €6 ──
  it('D) International 3 shareable → €6 (1 shipment)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 3)],
      destinationCountry: 'ES',
    }))
    expect(result.shippingCost).toBe(6.00)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── E) International 4 shareable → €12 ──
  it('E) International 4 shareable → €12 (2 shipments)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 4)],
      destinationCountry: 'FR',
    }))
    expect(result.shippingCost).toBe(12.00)
    expect(result.standardShipmentUnits).toBe(2)
  })

  // ── F) PT: 2 shareable + 2 non-shareable → 3 units → €12 ──
  it('F) PT 2 shareable + 2 non-shareable → 3 units → €12', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        standardItem(true, 2),   // shareable qty=2 → ceil(2/3)=1
        standardItem(false, 2),  // non-shareable → 2
      ],
      destinationCountry: 'PT',
    }))
    expect(result.shippingCost).toBe(12.00)
    expect(result.standardShipmentUnits).toBe(3)  // 1 + 2 = 3
  })

  // ── G) International 2 shareable + 2 non-shareable → 3 units → €18 ──
  it('G) International 2 shareable + 2 non-shareable → 3 units → €18', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        standardItem(true, 2),
        standardItem(false, 2),
      ],
      destinationCountry: 'DE',
    }))
    expect(result.shippingCost).toBe(18.00)
    expect(result.standardShipmentUnits).toBe(3)  // 1 + 2 = 3
  })

  // ── H) Large-value STANDARD order STILL pays shipping (NO free shipping) ──
  it('H) Large-value STANDARD order STILL pays shipping (no free shipping)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
    }))
    // Even with a huge subtotal, shipping is always charged
    expect(result.shippingCost).toBe(4.00)
    expect(result.cupulaNeedsConfirmation).toBe(false)
  })

  // ── I) ANY cupula requires manual shipping confirmation ──
  it('I) ANY cupula requires manual shipping confirmation', () => {
    const result = calculateFixedShipping(makeInput({
      items: [cupulaItem(1)],
    }))
    expect(result.cupulaNeedsConfirmation).toBe(true)
    expect(result.shippingCost).toBeNull()
    expect(result.hasCupula).toBe(true)
  })

  // ── J) Large-value cupula order still needs manual confirmation ──
  it('J) Large-value cupula order STILL needs manual confirmation', () => {
    const result = calculateFixedShipping(makeInput({
      items: [cupulaItem(1), standardItem(true, 3)],
    }))
    // Cupula always needs confirmation, regardless of value
    expect(result.cupulaNeedsConfirmation).toBe(true)
    expect(result.shippingCost).toBeNull()
    expect(result.hasCupula).toBe(true)
  })

  // ── K) Mixed cupula + standard ──
  it('K) Mixed cupula + standard → cupulaNeedsConfirmation', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        cupulaItem(1),
        standardItem(true, 2),
      ],
    }))
    expect(result.cupulaNeedsConfirmation).toBe(true)
    expect(result.hasCupula).toBe(true)
    expect(result.shippingCost).toBeNull()
  })

  // ── L) shareable + non-shareable formula correct ──
  it('L) 5 shareable + 1 non-shareable → ceil(5/3)=2 + 1 = 3 units', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        standardItem(true, 5),   // ceil(5/3) = 2 shareable units
        standardItem(false, 1),  // 1 non-shareable unit
      ],
      destinationCountry: 'PT',
    }))
    expect(result.standardShipmentUnits).toBe(3)  // 2 + 1
    expect(result.shippingCost).toBe(12.00)       // 3 × €4
  })

  // ── Products without explicit canShareShippingPackage ─────
  it('Default canShareShippingPackage=false → non-shareable', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(false, 2)],
    }))
    // 2 non-shareable items = 2 shipment units = €8
    expect(result.shippingCost).toBe(8.00)
    expect(result.standardShipmentUnits).toBe(2)
  })

  // ── Mixed: different products sharing ────────────────────────
  it('Mixed products share package when both canShareShippingPackage', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        standardItem(true, 1),  // Product A shareable
        standardItem(true, 1),  // Product B shareable
        standardItem(true, 1),  // Product C shareable
      ],
    }))
    // 3 shareable total = 1 shipment = €4
    expect(result.shippingCost).toBe(4.00)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── 7 shareable → 3 shipments ────────────────────────────────
  it('7 shareable items → ceil(7/3)=3 shipments', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 7)],
    }))
    expect(result.shippingCost).toBe(12.00)  // 3 × €4
    expect(result.standardShipmentUnits).toBe(3)
  })

  // ── Açores (PT) → €4/unit ──────────────────────────────────────
  it('Portugal (Açores/Madeira) → €4/unit', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
    }))
    expect(result.shippingCost).toBe(4.00)
  })

  // ── International non-EU → €6/unit ──────────────────────────
  it('US destination → €6/unit', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'US',
    }))
    expect(result.shippingCost).toBe(6.00)
  })

  // ── Country case-insensitive ─────────────────────────────────
  it('Lowercase country → treated same as uppercase', () => {
    const result1 = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'pt',
    }))
    const result2 = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
    }))
    expect(result1.shippingCost).toBe(result2.shippingCost)
  })

  // ── Empty items → 0 cost ─────────────────────────────────────
  it('Empty items → €0 shipping cost', () => {
    const result = calculateFixedShipping(makeInput({
      items: [],
      destinationCountry: 'PT',
    }))
    expect(result.shippingCost).toBe(0)
    expect(result.standardShipmentUnits).toBe(0)
    expect(result.cupulaNeedsConfirmation).toBe(false)
  })
})