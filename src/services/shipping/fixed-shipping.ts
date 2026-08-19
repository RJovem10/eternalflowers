/**
 * fixed-shipping.ts — Regras fixas de portes de envio (ISSUE-1Q)
 *
 * Serviço puro (sem IO, sem Payload) que calcula portes de envio
 * com base nas regras de negócio definidas.
 *
 * Regras:
 * - Standard PT (Continental + Açores + Madeira): €4/unidade de envio
 * - Standard International: €6/unidade de envio
 * - canShareShippingPackage=true: até 3 peças = 1 unidade de envio
 * - canShareShippingPackage=false: cada peça = 1 unidade de envio
 * - Discounts/coupons DO NOT change shipping calculation
 * - Cúpula → sempre portes a confirmar manualmente, independentemente do valor
 * - NUNCA existe portes grátis automático
 */

// ─── Tipos ──────────────────────────────────────────────────────

export interface FixedShippingItem {
  /** shippingClass do produto */
  shippingClass: 'standard' | 'cupula'
  /** Se o produto pode partilhar embalagem de envio (só relevante para standard) */
  canShareShippingPackage: boolean
  /** Quantidade deste produto no carrinho */
  qty: number
}

export interface FixedShippingInput {
  /** Items do carrinho/order com dados de envio */
  items: FixedShippingItem[]
  /** País de destino (ISO 3166-1 alpha-2) */
  destinationCountry: string
}

export interface FixedShippingResult {
  /** Custo total dos portes a cobrar ao cliente (0 se a confirmar) */
  shippingCost: number
  /** Se a encomenda contém cúpula */
  hasCupula: boolean
  /**
   * Se a cúpula necessita de confirmação manual de portes.
   * True quando contém pelo menos um item shippingClass=cupula.
   * Neste caso shippingCost é 0 mas o valor real será
   * confirmado depois da reserva manual do item.
   */
  cupulaNeedsConfirmation: boolean
  /**
   * Nº total de unidades de envio standard calculadas.
   * Útil para depuração/display.
   */
  standardShipmentUnits: number
}

// ─── Constantes ─────────────────────────────────────────────────

const SHIPPING_PRICE_PT = 4.00
const SHIPPING_PRICE_INTERNATIONAL = 6.00
const SHAREABLE_MAX_PER_UNIT = 3

/** Países considerados Portugal (Continente + Regiões Autónomas) */
const PT_COUNTRIES = new Set(['PT'])

// ─── Helpers ────────────────────────────────────────────────────

function isPortugal(country: string): boolean {
  return PT_COUNTRIES.has(country.toUpperCase())
}

function isStandard(item: FixedShippingItem): boolean {
  return item.shippingClass === 'standard'
}

function isCupula(item: FixedShippingItem): boolean {
  return item.shippingClass === 'cupula'
}

// ─── Cálculo principal ──────────────────────────────────────────

export function calculateFixedShipping(input: FixedShippingInput): FixedShippingResult {
  const { items, destinationCountry } = input
  const countryUpper = destinationCountry.toUpperCase()

  // ── 1. Determinar se há cúpula ──────────────────────────────
  const hasCupula = items.some(isCupula)

  // ── 2. Cúpula → sempre portes a confirmar manualmente ───────
  if (hasCupula) {
    return {
      shippingCost: 0,
      hasCupula: true,
      cupulaNeedsConfirmation: true,
      standardShipmentUnits: 0,
    }
  }

  // ── 3. Calcular unidades de envio standard ──────────────────
  // A partir daqui, só temos items standard (cupula já foi tratado acima)
  const standardItems = items.filter(isStandard)

  let totalShareableQty = 0
  let totalNonShareableQty = 0

  for (const item of standardItems) {
    if (item.canShareShippingPackage) {
      totalShareableQty += item.qty
    } else {
      totalNonShareableQty += item.qty
    }
  }

  // shareableShipmentUnits = ceil(totalShareableStandardQuantity / 3)
  const shareableShipmentUnits = Math.ceil(totalShareableQty / SHAREABLE_MAX_PER_UNIT)

  // standardShipmentUnits = shareable + nonShareable
  const standardShipmentUnits = shareableShipmentUnits + totalNonShareableQty

  // ── 4. Calcular custo por destino ───────────────────────────
  const pricePerUnit = isPortugal(countryUpper)
    ? SHIPPING_PRICE_PT
    : SHIPPING_PRICE_INTERNATIONAL

  const shippingCost = Number((standardShipmentUnits * pricePerUnit).toFixed(2))

  return {
    shippingCost,
    hasCupula: false,
    cupulaNeedsConfirmation: false,
    standardShipmentUnits,
  }
}