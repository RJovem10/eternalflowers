/**
 * order-lifecycle.ts — Lifecycle de Orders (ISSUE 1L)
 *
 * Responsabilidade:
 *   Expirar Orders pending_payment cujas reservas físicas já não são válidas
 *   (expiradas, released, em falta ou com expiresAt vencido).
 *
 * Regras:
 *   - made_to_order-only → não expira automaticamente.
 *   - Mixed order (made_to_order + unique/reproducible) → segue lifecycle
 *     das reservas físicas.
 *   - Reservation confirmed inesperadamente → skip + diagnóstico (não desfaz stock).
 *   - PaymentIntent processing/succeeded → não expira (deixa webhook resolver).
 *   - Stripe calls FORA de DB transaction.
 *   - NÃO criar cron/scheduler nesta ISSUE.
 */
import type { Payload } from 'payload'
import { runInTransaction } from './transact'
import { expireReservation, releaseReservation } from './stock'
import { cancelPaymentIntent } from './payments/stripe'
import type {
  ExpireAbandonedOptions,
  ExpireAbandonedSummary,
  OrderLifecycleResult,
} from './order-lifecycle-types'

// ─── Constantes ───────────────────────────────────────────────

const ORDER_STATUSES: ReadonlySet<string> = new Set([
  'confirmed', 'processing', 'shipped', 'completed', 'cancelled', 'expired',
])
const PAYMENT_STATUSES_SKIP: ReadonlySet<string> = new Set([
  'pending', 'paid', 'refunded',
])

// ─── Helpers ──────────────────────────────────────────────────

function isReservable(mode: string | null | undefined): boolean {
  return mode === 'unique' || mode === 'reproducible'
}

/**
 * Carrega as reservas associadas a uma Order através do campo `order`.
 */
async function loadReservationsByOrder(
  payload: Payload,
  orderId: number,
): Promise<any[]> {
  const result = await payload.find({
    collection: 'stock-reservations' as any,
    where: { order: { equals: orderId } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as any[]
}

/**
 * Determina se uma reserva é considerada inválida (não pode ser paga).
 * Retorna um objecto com:
 *   - invalid: true → reserva expirada, released, ou active com expiresAt <= now
 *   - invalid: false, confirmed: true → reserva confirmada (inconsistente)
 *   - invalid: false, confirmed: false → reserva active válida
 */
function checkReservationValidity(
  reservation: any,
  now: Date,
): { invalid: boolean; confirmed?: boolean } {
  if (reservation.status === 'confirmed') {
    return { invalid: false, confirmed: true }
  }
  if (reservation.status === 'expired' || reservation.status === 'released') {
    return { invalid: true }
  }
  if (reservation.status === 'active') {
    const expiresAt = new Date(reservation.expiresAt)
    if (expiresAt <= now) {
      return { invalid: true }
    }
    return { invalid: false, confirmed: false }
  }
  // Estado desconhecido — tratar como inválido
  return { invalid: true }
}

/**
 * Extrai o flowerId de um snapshot ou de uma reservation, normalizando
 * a forma relationship (object vs number).
 */
function resolveFlowerId(itemOrReservation: any): number {
  const f = itemOrReservation.flower
  return typeof f === 'object' ? f.id : f
}

/**
 * Estados do PaymentIntent que Stripe permite cancelar.
 */
function isCancelableStatus(status: string): boolean {
  return [
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'requires_capture',
  ].includes(status)
}

// ═══════════════════════════════════════════════════════════════
// expireAbandonedPendingOrders
// ═══════════════════════════════════════════════════════════════

/**
 * Avalia e expira Orders pending_payment cujas reservas físicas não
 * são mais válidas.
 *
 * Aceita `now` injectável para testes.
 * Devolve um resumo com resultados por Order.
 *
 * NOTA: Stripe calls correm FORA de DB transactions.
 */
export async function expireAbandonedPendingOrders(
  payload: Payload,
  options?: ExpireAbandonedOptions,
): Promise<ExpireAbandonedSummary> {
  const now = options?.now ?? new Date()
  const details: OrderLifecycleResult[] = []

  // ─── 1. Encontrar candidates ────────────────────────────────
  const candidates = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { orderStatus: { equals: 'pending_payment' } },
        {
          or: [
            { paymentStatus: { equals: 'unpaid' } },
            { paymentStatus: { equals: 'failed' } },
          ],
        },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const orders = candidates.docs as any[]

  for (const order of orders) {
    try {
      const result = await processOrder(payload, order, now)
      details.push(result)
    } catch (err: any) {
      details.push({
        kind: 'error',
        orderId: order.id,
        error: err?.message ?? 'Erro desconhecido',
      })
    }
  }

  const expired = details.filter((d) => d.kind === 'expired').length
  const skipped = details.filter((d) => d.kind.startsWith('skipped_')).length
  const errors = details.filter((d) => d.kind === 'error').length

  return {
    total: orders.length,
    expired,
    skipped,
    errors,
    details,
  }
}

// ═══════════════════════════════════════════════════════════════
// processOrder
// ═══════════════════════════════════════════════════════════════

async function processOrder(
  payload: Payload,
  order: any,
  now: Date,
): Promise<OrderLifecycleResult> {
  const orderId = order.id
  const items = (order.items as any[]) || []

  // ─── A. Determinar quais items requerem reservation ─────────
  const reservableItems = items.filter((item: any) => {
    const mode = item.productionMode
    return isReservable(mode)
  })

  // Se não existir nenhum item reservável → made_to_order-only (ou legacy null)
  if (reservableItems.length === 0) {
    return { kind: 'skipped_made_to_order_only', orderId }
  }

  // ─── B. Carregar reservas da Order ──────────────────────────
  const reservations = await loadReservationsByOrder(payload, orderId)

  // ─── C. Avaliar cada item reservável ────────────────────────
  let hasConfirmedReservation = false
  let hasInvalidReservation = false
  let hasMissingReservation = false

  for (const item of reservableItems) {
    const flowerId = resolveFlowerId(item)
    const matchingReservation = reservations.find(
      (r: any) => resolveFlowerId(r) === flowerId,
    )

    if (!matchingReservation) {
      hasMissingReservation = true
      continue
    }

    const validity = checkReservationValidity(matchingReservation, now)

    if (validity.invalid) {
      hasInvalidReservation = true
    }

    if (validity.confirmed) {
      hasConfirmedReservation = true
    }
  }

  // ─── D. Reservation confirmed inesperadamente ───────────────
  if (hasConfirmedReservation) {
    return {
      kind: 'skipped_inconsistent_confirmed_reservation',
      orderId,
    }
  }

  // ─── E. Todas as reservas válidas → nada a fazer ────────────
  if (!hasInvalidReservation && !hasMissingReservation) {
    return { kind: 'skipped_reservations_valid', orderId }
  }

  // ─── F. Tratar PaymentIntent FORA da transacção ─────────────
  const paymentIntentId = order.stripePaymentIntentId as string | undefined
  let paymentIntentCancelled = false

  if (paymentIntentId) {
    const cancelResult = await cancelPaymentIntent(paymentIntentId)

    if (cancelResult.canceled) {
      paymentIntentCancelled = true
    } else {
      const status = cancelResult.currentStatus

      // processing → não expirar
      if (status === 'processing') {
        return { kind: 'skipped_pi_processing', orderId }
      }

      // succeeded → não expirar pelo lifecycle
      if (status === 'succeeded') {
        return { kind: 'skipped_pi_succeeded', orderId }
      }

      // canceled (por race entre retrieve e a nossa decisão) → continuar cleanup
      if (status === 'canceled') {
        paymentIntentCancelled = true
        // fall through para cleanup
      }

      // Se ainda está num estado cancelável, o cancel deveria ter funcionado.
      // Algo de anormal aconteceu (config, transient, race) — não prosseguir
      // sem cancelar o PI, para não criar inconsistência Stripe-DB.
      if (isCancelableStatus(status)) {
        return {
          kind: 'error',
          orderId,
          error: `PaymentIntent ${paymentIntentId} está "${status}" mas cancel falhou. Abortando cleanup por segurança.`,
        }
      }

      // requires_capture ou outro estado terminal — continuar cleanup
      // (o cancelamento pode ter sido tentado por outra via).
    }
  }

  // ─── G. Transaction curta para cleanup ──────────────────────
  return runInTransaction(payload, undefined, async (ctx) => {
    return executeOrderExpiry(
      ctx,
      payload,
      orderId,
      reservations,
      reservableItems,
      now,
      paymentIntentCancelled,
    )
  })
}

// ═══════════════════════════════════════════════════════════════
// executeOrderExpiry (dentro de transaction)
// ═══════════════════════════════════════════════════════════════

async function executeOrderExpiry(
  ctx: any,
  payload: Payload,
  orderId: number,
  reservations: any[],
  reservableItems: any[],
  now: Date,
  paymentIntentCancelled: boolean,
): Promise<OrderLifecycleResult> {
  // ─── 1. Re-carregar Order dentro da transacção ──────────────
  const freshOrder = await payload.findByID({
    collection: 'orders',
    id: orderId,
    req: ctx.req,
    depth: 0,
    overrideAccess: true,
  }) as any

  if (!freshOrder) {
    return { kind: 'error', orderId, error: 'Order desapareceu entre leituras.' }
  }

  // ─── 2. Revalidar orderStatus / paymentStatus ───────────────
  if (ORDER_STATUSES.has(freshOrder.orderStatus)) {
    return {
      kind: 'skipped_not_candidate',
      orderId,
      reason: `orderStatus mudou para "${freshOrder.orderStatus}"`,
    }
  }
  if (PAYMENT_STATUSES_SKIP.has(freshOrder.paymentStatus)) {
    return {
      kind: 'skipped_not_candidate',
      orderId,
      reason: `paymentStatus mudou para "${freshOrder.paymentStatus}"`,
    }
  }

  // ─── 3. Revalidar reservas ──────────────────────────────────
  const freshReservations = await loadReservationsByOrder(payload, orderId)

  let expiredCount = 0
  let releasedCount = 0

  for (const item of reservableItems) {
    const flowerId = resolveFlowerId(item)
    const matchingReservation = freshReservations.find(
      (r: any) => resolveFlowerId(r) === flowerId,
    )

    if (!matchingReservation) {
      // Missing — já contribuiu para invalidação, nada a limpar
      continue
    }

    const validity = checkReservationValidity(matchingReservation, now)

    if (validity.invalid) {
      // Expirar reservas vencidas (active + expiresAt <= now)
      const expireResult = await expireReservation(payload, {
        reservationId: matchingReservation.id,
        req: ctx.req,
      })
      if (expireResult.kind === 'expired' || expireResult.kind === 'already_expired') {
        expiredCount++
      }
    } else if (validity.invalid === false && !validity.confirmed) {
      // Reserva ainda active e válida — libertar para não prender stock
      const releaseResult = await releaseReservation(payload, {
        reservationId: matchingReservation.id,
        req: ctx.req,
      })
      if (releaseResult.kind === 'released' || releaseResult.kind === 'already_released') {
        releasedCount++
      }
    }
    // confirmed: não mexer (já tratado como skip antes da transacção)
  }

  // ─── 4. Marcar Order como expired ───────────────────────────
  await payload.update({
    collection: 'orders',
    id: orderId,
    data: {
      orderStatus: 'expired',
      // paymentStatus permanece (unpaid/failed)
    } as any,
    req: ctx.req,
    overrideAccess: true,
  })

  return {
    kind: 'expired',
    orderId,
    expiredReservationCount: expiredCount,
    releasedReservationCount: releasedCount,
    paymentIntentCancelled,
  }
}