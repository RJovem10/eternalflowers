/**
 * stock-types.ts — Contratos de domínio para stock e reservas
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
  req?: any
}

export interface ExpireReservationInput {
  reservationId: number
  req?: any
}

// ─── Outcomes (situações que fazem COMMIT) ─────────────────────
export type ReserveStockOutcome =
  | { kind: 'created'; reservationId: number; expiresAt: string }
  | { kind: 'existing_active'; reservationId: number; expiresAt: string }
  | { kind: 'existing_confirmed'; reservationId: number; expiresAt: string }
  | { kind: 'attempt_terminated'; reservationId: number }

export type ConfirmReservationOutcome =
  | { kind: 'confirmed'; reservationId: number }
  | { kind: 'already_confirmed'; reservationId: number }
  | { kind: 'expired_now'; reservationId: number }
  | { kind: 'terminated'; reservationId: number; status: 'expired' | 'released' }

export type ReleaseReservationOutcome =
  | { kind: 'released'; reservationId: number }
  | { kind: 'already_released'; reservationId: number }
  | { kind: 'terminated'; reservationId: number; status: 'confirmed' | 'expired' }

export type ExpireReservationOutcome =
  | { kind: 'expired'; reservationId: number }
  | { kind: 'not_due'; reservationId: number }
  | { kind: 'already_expired'; reservationId: number }
  | { kind: 'terminated'; reservationId: number; status: 'confirmed' | 'released' }

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
export class InvalidProductError extends Error {
  code = 'INVALID_PRODUCT' as const
  constructor(msg = 'Produto inválido.') { super(msg) }
}
export class InvalidReservationError extends Error {
  code = 'INVALID_RESERVATION' as const
  constructor(msg = 'Reserva inválida.') { super(msg) }
}