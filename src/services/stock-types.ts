/**
 * stock-types.ts — Contratos de domínio para stock e reservas
 *
 * Esta ISSUE implementa apenas a infraestrutura transacional (Fase 1).
 * As funções de domínio (reserveStock, confirmReservation, etc.)
 * serão implementadas na Fase 2.
 */

// ─── Production mode ───────────────────────────────────────────
export type ProductionMode = 'unique' | 'reproducible' | 'made_to_order'

// ─── Estados da reserva ────────────────────────────────────────
export type ReservationStatus = 'active' | 'confirmed' | 'expired' | 'released'

// ─── Inputs ────────────────────────────────────────────────────
export interface ReserveStockInput {
  flowerId: number
  quantity: number
  checkoutAttemptId: string
  req?: any
}

export interface ConfirmReservationInput {
  reservationId: number
  req?: any
}

export interface ReleaseReservationInput {
  reservationId: number
  reason?: 'expired' | 'cancelled'
  req?: any
}

export interface ExpireReservationInput {
  reservationId: number
  req?: any
}

// ─── Outcomes (a callback transacional devolve um destes) ──────
// NOTA: situações que precisam de COMMIT. Erros (que provocam ROLLBACK)
// estão na secção de errors.

export type ReserveStockOutcome =
  | { type: 'created'; reservationId: number; expiresAt: string }
  | { type: 'existing_active'; reservationId: number; expiresAt: string }
  | { type: 'existing_confirmed'; reservationId: number; expiresAt: string }
  | { type: 'attempt_terminated' }

export type ConfirmReservationOutcome =
  | { type: 'confirmed' }
  | { type: 'already_confirmed' }
  | { type: 'expired_now' }
  | { type: 'terminated' }

export type ReleaseReservationOutcome =
  | { type: 'released' }
  | { type: 'already_released' }

export type ExpireReservationOutcome =
  | { type: 'transitioned' }
  | { type: 'noop' }

export type AvailableStockOutcome =
  | { available: true }
  | { available: false }

// ─── Erros de domínio (provocam ROLLBACK) ──────────────────────
export class OutOfStockError extends Error {
  code = 'OUT_OF_STOCK' as const
  constructor(msg = 'Stock insuficiente.') { super(msg) }
}
export class InvalidQuantityError extends Error {
  code = 'INVALID_QUANTITY' as const
  constructor(msg = 'Quantidade inválida.') { super(msg) }
}
export class InvalidCheckoutAttemptError extends Error {
  code = 'INVALID_CHECKOUT_ATTEMPT' as const
  constructor(msg = 'Tentativa de checkout inválida.') { super(msg) }
}
export class IdempotencyConflictError extends Error {
  code = 'IDEMPOTENCY_CONFLICT' as const
  constructor(msg = 'Conflito de idempotência.') { super(msg) }
}
export class ProductNotReservableError extends Error {
  code = 'PRODUCT_NOT_RESERVABLE' as const
  constructor(msg = 'Produto não pode ser reservado.') { super(msg) }
}
export class StockInvariantViolation extends Error {
  code = 'STOCK_INVARIANT_VIOLATION' as const
  constructor(msg = 'Invariante de stock violada.') { super(msg) }
}
export class StockBusyRetryError extends Error {
  code = 'STOCK_BUSY_RETRY' as const
  constructor(msg = 'Base de dados ocupada. Tentar novamente.') { super(msg) }
}