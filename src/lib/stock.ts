/**
 * stock.ts — Modelo de Produtos: productionMode, stockStatus, validações
 *
 * NOTA: Os 10 produtos demo existentes podem ter productionMode=null.
 * A validação só é aplicada quando productionMode está preenchido.
 * Na criação, productionMode é obrigatório (excepto para produtos demo existentes).
 */

export type ProductionMode = 'unique' | 'reproducible' | 'made_to_order'

export type StockStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'made_to_order'
  | 'reserved'
  | 'preparing'
  | 'sold'
  | 'unknown'

export const LOW_STOCK_THRESHOLD = 2

/**
 * Deriva o stockStatus a partir de productionMode, stockQuantity e availability.
 *
 * Regras de precedência:
 * 1. availability (reserved/preparing/sold) prevalece sobre tudo
 * 2. Se productionMode não preenchido → unknown
 * 3. unique: stock 1 = in_stock, stock 0 = sold
 * 4. made_to_order: sempre made_to_order
 * 5. reproducible: stock 0 = out_of_stock, 1-2 = low_stock, 3+ = in_stock
 */
export function deriveStockStatus(
  productionMode: ProductionMode | null | undefined,
  stockQuantity: number,
  availability: string,
): StockStatus {
  // availability tem precedência sobre stockQuantity
  if (availability === 'reserved') return 'reserved'
  if (availability === 'preparing') return 'preparing'
  if (availability === 'sold') return 'sold'

  // productionMode não preenchido (ex: produtos demo) — unknown
  if (!productionMode) return 'unknown'

  if (productionMode === 'unique') {
    return stockQuantity === 0 ? 'sold' : 'in_stock'
  }

  if (productionMode === 'made_to_order') return 'made_to_order'

  if (productionMode === 'reproducible') {
    if (stockQuantity === 0) return 'out_of_stock'
    if (stockQuantity <= LOW_STOCK_THRESHOLD) return 'low_stock'
    return 'in_stock'
  }

  return 'unknown'
}

/**
 * Valida os campos productionMode, productionLeadTime e stockQuantity.
 *
 * Regras:
 * - Criação: productionMode é obrigatório
 * - Actualização de produto demo (productionMode=null): permitir sem productionMode
 * - Quando productionMode está preenchido, todas as validações do modelo aplicam-se
 * - stockQuantity e productionLeadTime devem ser inteiros
 */
export function validateProductModel(
  data: Record<string, unknown>,
  operation: 'create' | 'update',
  originalDoc?: Record<string, unknown> | null,
): string[] {
  const errors: string[] = []
  const mode = data.productionMode as ProductionMode | undefined | null
  const existingMode = originalDoc?.productionMode as ProductionMode | undefined | null

  // Regra 1: Criação — productionMode é obrigatório
  if (operation === 'create' && (mode == null || mode === '' as any)) {
    errors.push(
      'Modo de Produção (productionMode) é obrigatório para novos produtos. ' +
      'Selecione Peça Única, Reproduzível ou Produzido por Encomenda.',
    )
    return errors // sem productionMode, o resto não faz sentido
  }

  // Regra 2: Actualização de produto demo existente — permitir sem productionMode
  const isDemoProduct = existingMode == null

  if (operation === 'update' && isDemoProduct && (mode == null || mode === '' as any)) {
    return errors // demo product mantém-se sem classificação — sem validações
  }

  // Regra 3: Se ainda não há productionMode após as regras acima, sair
  if (!mode) return errors

  // ─── Validações de inteiros ────────────────────────────────────

  // stockQuantity deve ser inteiro
  const qty = data.stockQuantity as number | undefined
  if (qty != null) {
    if (!Number.isInteger(qty)) {
      errors.push('stockQuantity deve ser um número inteiro.')
    } else if (qty < 0) {
      errors.push('stockQuantity não pode ser negativo.')
    }
  }

  // productionLeadTime deve ser inteiro quando preenchido
  const leadTime = data.productionLeadTime as number | null | undefined
  if (leadTime != null) {
    if (!Number.isInteger(leadTime)) {
      errors.push('Prazo de produção (productionLeadTime) deve ser um número inteiro.')
    }
  }

  // ─── Validações por productionMode ──────────────────────────────

  // unique
  if (mode === 'unique') {
    if (qty !== 0 && qty !== 1) {
      errors.push('Peça única (unique) deve ter stockQuantity 0 (vendido) ou 1 (disponível).')
    }
    const avail = data.availability as string | undefined
    if (avail === 'sold' && qty !== 0) {
      errors.push('Peça única vendida (availability=sold) deve ter stockQuantity=0.')
    }
    if ((avail === 'available' || avail === 'reserved' || avail === 'preparing') && qty !== 1) {
      errors.push('Peça única disponível deve ter stockQuantity=1.')
    }
    if (leadTime != null) {
      errors.push('Peça única (unique) não pode ter prazo de produção. Defina productionLeadTime como vazio.')
    }
  }

  // made_to_order
  if (mode === 'made_to_order') {
    if (qty !== 0) {
      errors.push('Produzido por encomenda (made_to_order) deve ter stockQuantity=0.')
    }
    if (leadTime == null || !Number.isInteger(leadTime) || leadTime < 1 || leadTime > 255) {
      errors.push('Produzido por encomenda (made_to_order) precisa de productionLeadTime inteiro entre 1 e 255 dias.')
    }
  }

  // reproducible
  if (mode === 'reproducible') {
    if (qty == null || !Number.isInteger(qty) || qty < 0) {
      errors.push('Reproduzível (reproducible) precisa de stockQuantity inteiro >= 0.')
    }
  }

  return errors
}