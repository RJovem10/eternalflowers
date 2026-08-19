/**
 * Testes unitários para fixed-shipping.ts — cálculo de portes fixos
 *
 * Cobre os casos A-L especificados na ISSUE-1Q.
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
    productSubtotal: 50,
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
  // ── A) PT, subtotal €50, 1 shareable standard item => €4 ──
  it('A) PT 1 shareable → €4', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(4.00)
    expect(result.isFree).toBe(false)
    expect(result.cupulaNeedsConfirmation).toBe(false)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── B) PT, subtotal €50, 3 shareable standard items => €4 ──
  it('B) PT 3 shareable → €4 (1 shipment)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 3)],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(4.00)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── C) PT, subtotal €50, 4 shareable standard items => €8 ──
  it('C) PT 4 shareable → €8 (2 shipments)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 4)],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(8.00)
    expect(result.standardShipmentUnits).toBe(2)
  })

  // ── D) International, subtotal €50, 3 shareable => €6 ──────
  it('D) International 3 shareable → €6 (1 shipment)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 3)],
      destinationCountry: 'ES',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(6.00)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── E) International, subtotal €50, 4 shareable => €12 ─────
  it('E) International 4 shareable → €12 (2 shipments)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 4)],
      destinationCountry: 'FR',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(12.00)
    expect(result.standardShipmentUnits).toBe(2)
  })

  // ── F) PT: 2 shareable + 2 non-shareable => 3 units => €12 ─
  it('F) PT 2 shareable + 2 non-shareable → 3 units → €12', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        standardItem(true, 2),   // shareable qty=2 → ceil(2/3)=1
        standardItem(false, 2),  // non-shareable → 2
      ],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(12.00)
    expect(result.standardShipmentUnits).toBe(3)  // 1 + 2 = 3
  })

  // ── G) International: 2 shareable + 2 non-shareable => €18 ─
  it('G) International 2 shareable + 2 non-shareable → 3 units → €18', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        standardItem(true, 2),
        standardItem(false, 2),
      ],
      destinationCountry: 'DE',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(18.00)
    expect(result.standardShipmentUnits).toBe(3)  // 1 + 2 = 3
  })

  // ── H) Subtotal exactly €100.00 → normal shipping applies ──
  it('H) Subtotal exactly €100 → NOT free', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      productSubtotal: 100.00,
    }))
    expect(result.isFree).toBe(false)
    expect(result.shippingCost).toBe(4.00)
  })

  // ── I) Subtotal €100.01 → free shipping ─────────────────────
  it('I) Subtotal €100.01 → free shipping', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 3)],
      destinationCountry: 'US',
      productSubtotal: 100.01,
    }))
    expect(result.isFree).toBe(true)
    expect(result.shippingCost).toBe(0)
  })

  // ── J) Cupula ≤ €100 → no fixed rate ────────────────────────
  it('J) Cupula ≤ €100 → cupulaNeedsConfirmation', () => {
    const result = calculateFixedShipping(makeInput({
      items: [cupulaItem(1)],
      productSubtotal: 80,
    }))
    expect(result.cupulaNeedsConfirmation).toBe(true)
    expect(result.isFree).toBe(false)
    expect(result.shippingCost).toBe(0)
  })

  // ── K) Cupula order > €100 → free shipping ──────────────────
  it('K) Cupula > €100 → free shipping (isFree)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [cupulaItem(1)],
      productSubtotal: 150,
    }))
    expect(result.isFree).toBe(true)
    expect(result.shippingCost).toBe(0)
    expect(result.cupulaNeedsConfirmation).toBe(false)
  })

  // ── L) Products without explicit canShareShippingPackage ─────
  // Default is false for all items
  it('L) Default canShareShippingPackage=false → non-shareable', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(false, 2)],
      productSubtotal: 50,
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
      productSubtotal: 50,
    }))
    // 3 shareable total = 1 shipment = €4
    expect(result.shippingCost).toBe(4.00)
    expect(result.standardShipmentUnits).toBe(1)
  })

  // ── 7 shareable → 3 shipments ────────────────────────────────
  it('7 shareable items → ceil(7/3)=3 shipments', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 7)],
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(12.00)  // 3 × €4
    expect(result.standardShipmentUnits).toBe(3)
  })

  // ── Free shipping trumps cupula ──────────────────────────────
  it('Cupula + subtotal > €100 → free (not needsConfirmation)', () => {
    const result = calculateFixedShipping(makeInput({
      items: [
        cupulaItem(1),
        standardItem(true, 2),
      ],
      productSubtotal: 120,
    }))
    expect(result.isFree).toBe(true)
    expect(result.shippingCost).toBe(0)
    expect(result.cupulaNeedsConfirmation).toBe(false)
  })

  // ── Açores = PT pricing ──────────────────────────────────────
  it('Açores (PT) → €4/unit', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(4.00)
  })

  // ── Madeira = PT pricing ─────────────────────────────────────
  it('Madeira (PT) → €4/unit', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(4.00)
  })

  // ── International non-EU → €6/unit ──────────────────────────
  it('US destination → €6/unit', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'US',
      productSubtotal: 50,
    }))
    expect(result.shippingCost).toBe(6.00)
  })

  // ── Free shipping with international ─────────────────────────
  it('International + subtotal > €100 → free', () => {
    const result = calculateFixedShipping(makeInput({
      items: [standardItem(true, 3)],
      destinationCountry: 'JP',
      productSubtotal: 200,
    }))
    expect(result.isFree).toBe(true)
    expect(result.shippingCost).toBe(0)
  })

  // ── Country case-insensitive ─────────────────────────────────
  it('Lowercase country → treated same as uppercase', () => {
    const result1 = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'pt',
      productSubtotal: 50,
    }))
    const result2 = calculateFixedShipping(makeInput({
      items: [standardItem(true, 1)],
      destinationCountry: 'PT',
      productSubtotal: 50,
    }))
    expect(result1.shippingCost).toBe(result2.shippingCost)
  })
})