/**
 * stock.ts — Serviço de domínio para stock e reservas (Fase 2A)
 *
 * Funções implementadas:
 * - reserveStock()
 * - getAvailableStock()
 *
 * Depende de:
 * - transact.ts (runInTransaction, runInTransactionWithRetry)
 * - db-adapter.ts (lockFlowerForUpdate, sumActiveReservedQuantity)
 * - stock-types.ts (outcomes, erros tipados)
 */

import type { Payload } from 'payload'
import crypto from 'crypto'
import {
  runInTransaction,
  runInTransactionWithRetry,
  type TransactionCtx,
} from './transact'
import { lockFlowerForUpdate, sumActiveReservedQuantity } from './db-adapter'
import type { ReserveStockInput, ReserveStockOutcome } from './stock-types'
import {
  InvalidQuantityError,
  InvalidCheckoutAttemptError,
  ProductNotReservableError,
  OutOfStockError,
  IdempotencyConflictError,
  StockInvariantViolation,
  InvalidProductError,
} from './stock-types'

// ─── Helpers ──────────────────────────────────────────────────

const RESERVATION_DURATION_MS = 30 * 60 * 1000 // 30 minutos

function validateUUIDv4(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

function hashIdempotencyKey(checkoutAttemptId: string, flowerId: number): string {
  return crypto
    .createHash('sha256')
    .update(`reserve:${checkoutAttemptId}:${flowerId}`)
    .digest('hex')
}

// ─── reserveStock ─────────────────────────────────────────────

export async function reserveStock(
  payload: Payload,
  input: ReserveStockInput,
): Promise<ReserveStockOutcome> {
  // ─── Validação de input (antes da transação) ───────────────
  if (!Number.isInteger(input.flowerId) || input.flowerId < 1) {
    throw new InvalidProductError('flowerId deve ser um inteiro positivo.')
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new InvalidQuantityError('quantity deve ser um inteiro positivo.')
  }
  if (typeof input.checkoutAttemptId !== 'string' || !validateUUIDv4(input.checkoutAttemptId)) {
    throw new InvalidCheckoutAttemptError('checkoutAttemptId inválido. Deve ser um UUID v4.')
  }

  // ─── Transação com retry (SQLite: até 3 tentativas) ────────
  return runInTransactionWithRetry(payload, input.req, async (ctx) => {
    return executeReserve(ctx, payload, input)
  })
}

async function executeReserve(
  ctx: TransactionCtx,
  payload: Payload,
  input: ReserveStockInput,
): Promise<ReserveStockOutcome> {
  const now = new Date()
  const keyHash = hashIdempotencyKey(input.checkoutAttemptId, input.flowerId)

  // 1. Lock da flower
  await lockFlowerForUpdate(ctx, input.flowerId)

  // 2. Ler flower (linha bloqueada)
  const flower = await payload.findByID({
    collection: 'flowers',
    id: input.flowerId,
    req: ctx.req,
    depth: 0,
  }) as any

  // 3. Idempotência (antes das regras comerciais)
  const existing = await payload.find({
    collection: 'stock-reservations' as any,
    where: { idempotencyKeyHash: { equals: keyHash } },
    limit: 1,
    req: ctx.req,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const r = existing.docs[0] as any

    // A. Mesma quantidade + active + expiresAt > now → devolver existente
    if (r.status === 'active' && r.quantity === input.quantity && new Date(r.expiresAt) > now) {
      return { kind: 'existing_active', reservationId: r.id, expiresAt: r.expiresAt }
    }

    // B. Mesma quantidade + confirmed → devolver existente
    if (r.status === 'confirmed' && r.quantity === input.quantity) {
      return { kind: 'existing_confirmed', reservationId: r.id, expiresAt: r.expiresAt }
    }

    // C. Active mas expirou → marcar expired e devolver attempt_terminated
    if (r.status === 'active' && new Date(r.expiresAt) <= now) {
      await payload.update({
        collection: 'stock-reservations' as any,
        id: r.id,
        data: { status: 'expired', expiredAt: now.toISOString() },
        req: ctx.req,
        overrideAccess: true,
      })
      return { kind: 'attempt_terminated', reservationId: r.id }
    }

    // D. Expired ou released → attempt_terminated
    if (r.status === 'expired' || r.status === 'released') {
      return { kind: 'attempt_terminated', reservationId: r.id }
    }

    // E. Quantidade diferente → conflito
    throw new IdempotencyConflictError(
      `checkoutAttemptId ${input.checkoutAttemptId} já usado para o mesmo produto com quantidade diferente.`,
    )
  }

  // 4. Regras comerciais (só se não existir idempotência)

  // Não classificado / demo
  if (!flower.productionMode) {
    throw new ProductNotReservableError('Produto não classificado. Não pode ser reservado.')
  }

  // made_to_order
  if (flower.productionMode === 'made_to_order') {
    throw new ProductNotReservableError('Produto made_to_order não usa reservas.')
  }

  // availability bloqueia
  if (['reserved', 'sold', 'preparing'].includes(flower.availability)) {
    throw new ProductNotReservableError(
      `Produto com availability=${flower.availability} não pode ser reservado.`,
    )
  }

  // Unique: quantity deve ser 1
  if (flower.productionMode === 'unique') {
    if (input.quantity !== 1) {
      throw new InvalidQuantityError('Produto unique só aceita quantity=1.')
    }
  }

  // 5. Stock disponível (após lock)
  const reservedQty = await sumActiveReservedQuantity(ctx, input.flowerId, now)
  const physicalStock = flower.stockQuantity ?? 0
  const available = physicalStock - reservedQty

  if (input.quantity > available) {
    throw new OutOfStockError(
      `Stock insuficiente. Pedido: ${input.quantity}, disponível: ${available}.`,
    )
  }

  // 6. Criar reserva
  const reservation = await payload.create({
    collection: 'stock-reservations' as any,
    data: {
      flower: input.flowerId,
      quantity: input.quantity,
      status: 'active',
      idempotencyKeyHash: keyHash,
      expiresAt: new Date(now.getTime() + RESERVATION_DURATION_MS).toISOString(),
    },
    req: ctx.req,
    overrideAccess: true,
  }) as any

  return {
    kind: 'created',
    reservationId: reservation.id,
    expiresAt: reservation.expiresAt,
  }
}

// ─── getAvailableStock ────────────────────────────────────────

export async function getAvailableStock(
  payload: Payload,
  flowerId: number,
): Promise<{ available: boolean }> {
  const flower = await payload.findByID({
    collection: 'flowers',
    id: flowerId,
    depth: 0,
  }) as any

  // Produto inexistente → NotFound propaga
  if (!flower.productionMode) return { available: false }

  // made_to_order: verificar antes do bloqueio genérico
  if (flower.productionMode === 'made_to_order') {
    return { available: flower.availability === 'available' || flower.availability === 'preparing' }
  }

  // unique/reproducible: availability bloqueia
  if (['reserved', 'sold', 'preparing'].includes(flower.availability)) {
    return { available: false }
  }

  const physical = flower.stockQuantity ?? 0
  if (physical <= 0) return { available: false }

  // Reservas activas (paginação completa)
  let reservedQty = 0
  let page = 1
  const limit = 100
  const now = new Date()

  while (true) {
    const reservations = await payload.find({
      collection: 'stock-reservations' as any,
      where: {
        flower: { equals: flowerId },
        status: { equals: 'active' },
        expiresAt: { greater_than: now.toISOString() },
      },
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    for (const r of reservations.docs) {
      reservedQty += (r as any).quantity ?? 0
    }

    if (reservations.docs.length < limit) break
    page++
  }

  return { available: (physical - reservedQty) > 0 }
}