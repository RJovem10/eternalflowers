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
 * - Subtotal > €100 → portes grátis para toda a encomenda
 * - Cúpula ≤ €100 → sem preço fixo ("portes a confirmar")
 * - Cúpula > €100 → portes grátis (pela regra de free shipping)
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
  /** Subtotal do produto após descontos, ANTES dos portes */
  productSubtotal: number
}

export interface FixedShippingResult {
  /** Custo total dos portes a cobrar ao cliente (0 se grátis ou a confirmar) */
  shippingCost: number
  /** Se o envio é gratuito (subtotal > €100) */
  isFree: boolean
  /** Se a encomenda contém cúpula e não atinge o limiar de portes grátis */
  hasCupula: boolean
  /**
   * Se a cúpula necessita de confirmação manual de portes.
   * True quando:
   * - contém pelo menos um item shippingClass=cupula
   * - productSubtotal <= 100
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
const FREE_SHIPPING_THRESHOLD = 100.00
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
  const { items, destinationCountry, productSubtotal } = input
  const countryUpper = destinationCountry.toUpperCase()

  // ── 1. Determinar se há cúpula ──────────────────────────────
  const hasCupula = items.some(isCupula)

  // ── 2. Determinar se aplica portes grátis ───────────────────
  // Estritamente > €100 (100.00 não conta)
  const isFree = productSubtotal > FREE_SHIPPING_THRESHOLD

  if (isFree) {
    return {
      shippingCost: 0,
      isFree: true,
      hasCupula,
      cupulaNeedsConfirmation: false,
      standardShipmentUnits: 0,
    }
  }

  // ── 3. Cúpula sem free shipping ─────────────────────────────
  if (hasCupula) {
    return {
      shippingCost: 0,
      isFree: false,
      hasCupula: true,
      cupulaNeedsConfirmation: true,
      standardShipmentUnits: 0,
    }
  }

  // ── 4. Calcular unidades de envio standard ──────────────────
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

  // ── 5. Calcular custo por destino ───────────────────────────
  const pricePerUnit = isPortugal(countryUpper)
    ? SHIPPING_PRICE_PT
    : SHIPPING_PRICE_INTERNATIONAL

  const shippingCost = Number((standardShipmentUnits * pricePerUnit).toFixed(2))

  return {
    shippingCost,
    isFree: false,
    hasCupula: false,
    cupulaNeedsConfirmation: false,
    standardShipmentUnits,
  }
}