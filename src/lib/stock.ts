/**
 * stock.ts — Modelo de Produtos: productionMode, stockStatus, validações
 *
 * NOTA: Os 10 produtos demo existentes podem ter productionMode=null.
 * A validação só é aplicada quando productionMode está preenchido.
 * Na criação, productionMode é obrigatório.
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
  if (availability === 'reserved') return 'reserved'
  if (availability === 'preparing') return 'preparing'
  if (availability === 'sold') return 'sold'
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
 * Regras de create/update:
 *   A. Criação: productionMode é obrigatório
 *   B. Update de demo (productionMode=null): permitir sem classificação
 *   C. Update de classificado: NÃO pode limpar productionMode (null, '' ou undefined explícito)
 *   D. Campo não enviado no PATCH: preservar originalDoc.productionMode
 *
 * Regras de valores:
 *   - stockQuantity e productionLeadTime devem ser inteiros (Number.isInteger)
 *   - unique: stock 0 ou 1, leadTime null
 *   - made_to_order: stock 0, leadTime 1-255
 *   - reproducible: stock >= 0
 */
export function validateProductModel(
  data: Record<string, unknown>,
  operation: 'create' | 'update',
  originalDoc?: Record<string, unknown> | null,
): string[] {
  const errors: string[] = []

  const rawMode: unknown = data.productionMode
  const modeWasSent = rawMode !== undefined
  const mode = rawMode as ProductionMode | null | undefined
  const existingMode = (originalDoc?.productionMode ?? null) as ProductionMode | null | undefined

  const modeIsEmpty = mode == null || (mode as unknown) === ''

  // ─── Regras de create/update sobre productionMode ────────────────

  // A. Criação — productionMode é obrigatório
  if (operation === 'create' && (!modeWasSent || modeIsEmpty)) {
    errors.push(
      'Modo de Produção (productionMode) é obrigatório para novos produtos. ' +
      'Selecione Peça Única, Reproduzível ou Produzido por Encomenda.',
    )
    return errors
  }

  const isDemo = existingMode == null

  // B. Update de demo — permitir sem productionMode (null ou não enviado)
  if (operation === 'update' && isDemo && (!modeWasSent || modeIsEmpty)) {
    return errors
  }

  // C. Update de classificado — NÃO pode limpar productionMode
  if (operation === 'update' && !isDemo && modeWasSent && modeIsEmpty) {
    errors.push(
      'Modo de Produção (productionMode) não pode ser removido de um produto já classificado. ' +
      'Para alterar, escolha um valor válido: Peça Única, Reproduzível ou Produzido por Encomenda.',
    )
    return errors
  }

  // D. Campo não enviado (PATCH parcial) — preservar valor existente
  const effectiveMode = modeWasSent ? mode : existingMode

  // Se não há productionMode, sair (apenas produtos demo sem classificação)
  if (!effectiveMode) return errors

  // ─── Validações de inteiros ────────────────────────────────────

  const qty = data.stockQuantity as number | undefined
  if (qty != null) {
    if (!Number.isInteger(qty)) {
      errors.push('stockQuantity deve ser um número inteiro.')
    } else if (qty < 0) {
      errors.push('stockQuantity não pode ser negativo.')
    }
  }

  const leadTime = data.productionLeadTime as number | null | undefined
  if (leadTime != null) {
    if (!Number.isInteger(leadTime)) {
      errors.push('Prazo de produção (productionLeadTime) deve ser um número inteiro.')
    }
  }

  // ─── Validações por productionMode ──────────────────────────────

  // unique
  if (effectiveMode === 'unique') {
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
  if (effectiveMode === 'made_to_order') {
    if (qty !== 0) {
      errors.push('Produzido por encomenda (made_to_order) deve ter stockQuantity=0.')
    }
    if (leadTime == null || !Number.isInteger(leadTime) || leadTime < 1 || leadTime > 255) {
      errors.push('Produzido por encomenda (made_to_order) precisa de productionLeadTime inteiro entre 1 e 255 dias.')
    }
  }

  // reproducible
  if (effectiveMode === 'reproducible') {
    if (qty == null || !Number.isInteger(qty) || qty < 0) {
      errors.push('Reproduzível (reproducible) precisa de stockQuantity inteiro >= 0.')
    }
  }

  return errors
}