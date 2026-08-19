/**
 * Shared commerce logic for determining whether a product is purchasable
 * and what Schema.org availability value to expose in structured data.
 *
 * MUST match the exact business rules in ProductInfo.tsx's canAddToCart logic.
 * Centralised here so UI (AddToCartButton) and structured data (Product JSON-LD)
 * cannot diverge.
 */

export interface PurchaseEligibilityInput {
  availability: string
  productionMode?: string | null
  stockQuantity?: number | null
}

export interface PurchaseEligibilityResult {
  /** True if the customer can place this product in their cart */
  canPurchase: boolean
  /** Schema.org availability URL for structured data */
  schemaAvailability: string
}

/**
 * Pure function — no side effects, no DB calls.
 *
 * Business rules (mirrors ProductInfo.tsx):
 *
 * - availability === 'sold'       → NOT purchasable
 * - availability === 'reserved'    → NOT purchasable
 * - productionMode === 'reproducible' + stockQuantity === 0 → NOT purchasable
 * - availability === 'preparing' + productionMode !== 'made_to_order' → NOT purchasable
 * - all other states              → purchasable
 *
 * Schema.org availability mapping:
 * - sold / reserved / out-of-stock-reproducible → OutOfStock
 * - preparing + not made_to_order              → OutOfStock
 * - purchasable + preparing + made_to_order    → PreOrder
 * - purchasable + sold / reserved / unavailable → OutOfStock
 * - otherwise                                  → InStock
 */
export function computePurchaseEligibility(input: PurchaseEligibilityInput): PurchaseEligibilityResult {
  const { availability, productionMode, stockQuantity } = input

  const isSold = availability === 'sold'
  const isReserved = availability === 'reserved'
  const isOutOfStockReproducible = productionMode === 'reproducible' && (stockQuantity ?? 0) === 0
  const isPreparingBlocked = availability === 'preparing' && productionMode !== 'made_to_order'

  let canPurchase: boolean
  if (!productionMode) {
    // Legacy mode: only sold/reserved block
    canPurchase = !isSold && !isReserved
  } else {
    canPurchase = !isSold && !isReserved && !isOutOfStockReproducible && !isPreparingBlocked
  }

  // Determine Schema.org availability
  let schemaAvailability: string
  if (isSold || isReserved || isOutOfStockReproducible || isPreparingBlocked) {
    schemaAvailability = 'https://schema.org/OutOfStock'
  } else if (availability === 'preparing') {
    // preparing + made_to_order — purchasable but not immediately available
    schemaAvailability = 'https://schema.org/PreOrder'
  } else if (availability === 'sold' || availability === 'reserved') {
    schemaAvailability = 'https://schema.org/OutOfStock'
  } else {
    schemaAvailability = 'https://schema.org/InStock'
  }

  return { canPurchase, schemaAvailability }
}