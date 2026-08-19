/**
 * checkout-finalization.ts — Finalização de checkout (Issue 1F / 1J / 1Q)
 *
 * Responsabilidades:
 * - Cálculo de portes fixos server-side (nunca confia no cliente)
 * - Cálculo do total final
 * - Criação idempotente das reservas de stock
 * - Transição draft → pending_payment (standard) ou awaiting_shipping (cupula)
 *
 * Fluxo:
 *   A. Carregar/validar Order (fora da transacção)
 *   B. Calcular portes fixos FORA da transacção
 *   C. Iniciar transacção
 *   D. Revalidar estado da Order
 *   E. Persistir checkoutAttemptId se necessário
 *   F. Criar/reutilizar reservas
 *   G. Guardar shipping snapshot + total
 *   H. orderStatus → pending_payment (standard) ou awaiting_shipping (cupula)
 *   I. paymentStatus continua unpaid
 *   J. Commit
 *
 * NOTA: parcel/provider/origin são opcionais — para fixed shipping,
 * o cálculo usa apenas os items da Order + país de destino.
 */
import type { Payload } from 'payload'
import crypto from 'crypto'
import { type ShippingParcel } from './shipping/shipping-types'
import { calculateFixedShipping, type FixedShippingItem } from './shipping/fixed-shipping'
import { reserveStock } from './stock'
import { runInTransaction, type TransactionCtx } from './transact'
import type {
  PrepareOrderInput,
  PrepareOrderResult,
} from './checkout-finalization-types'
import {
  CheckoutFinalizationError,
  InvalidOrderStateError,
  NegativeTotalError,
  CupulaShippingNeedsConfirmationError,
} from './checkout-finalization-types'

// ─── UUID v4 generator ─────────────────────────────────────

function generateCheckoutAttemptId(): string {
  return crypto.randomUUID()
}

// ─── Prepare Order For Payment ──────────────────────────────

export async function prepareOrderForPayment(
  payload: Payload,
  input: PrepareOrderInput,
): Promise<PrepareOrderResult> {
  // ════════════════════════════════════════════════════════
  // A. Carregar/validar Order (fora da transacção)
  // ════════════════════════════════════════════════════════

  const order = await payload.findByID({
    collection: 'orders',
    id: input.orderId,
    depth: 0,
    overrideAccess: true,
  }) as any

  if (!order || !order.id) {
    throw new CheckoutFinalizationError(`Order ${input.orderId} não encontrada.`)
  }

  // ── A1. Verificar se já está pending_payment (idempotência) ──
  if (order.orderStatus === 'pending_payment' || order.orderStatus === 'awaiting_shipping') {
    // Já finalizada: devolver resultado existente
    if (!order.checkoutAttemptId) {
      // Estado inconsistente — checkoutAttemptId devia existir
      throw new InvalidOrderStateError(
        `Order ${input.orderId} está ${order.orderStatus} sem checkoutAttemptId.`,
        'Estado inconsistente: sem checkoutAttemptId.',
      )
    }
    return {
      order,
      kind: 'already_prepared',
      checkoutAttemptId: order.checkoutAttemptId,
    }
  }

  // ── A2. Verificar se está em draft (único estado válido para finalizar) ──
  if (order.orderStatus !== 'draft') {
    throw new InvalidOrderStateError(
      `Order ${input.orderId} está "${order.orderStatus}". Apenas "draft" pode ser finalizada.`,
      `Estado actual: ${order.orderStatus}`,
    )
  }

  // Calcular subtotal a partir dos items da Order (server-side)
  const items = (order.items as any[]) || []
  const subtotal = items.reduce((acc: number, item: any) => acc + (Number(item.lineTotal) || 0), 0)

  if (subtotal <= 0) {
    throw new CheckoutFinalizationError(`Order ${input.orderId} tem subtotal inválido.`)
  }

  // ════════════════════════════════════════════════════════
  // B. Calcular portes fixos FORA da transacção
  // ════════════════════════════════════════════════════════

  // Carregar dados de envio dos produtos (shippingClass + canShareShippingPackage)
  const fixedItems: FixedShippingItem[] = []
  for (const item of items) {
    const flowerId = typeof item.flower === 'object' ? item.flower.id : item.flower
    const flower = await payload.findByID({
      collection: 'flowers',
      id: flowerId,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!flower || !flower.id) {
      throw new CheckoutFinalizationError(
        `Flor ${flowerId} (item da Order) não encontrada ao calcular portes.`,
      )
    }

    fixedItems.push({
      shippingClass: flower.shippingClass || 'standard',
      canShareShippingPackage: flower.canShareShippingPackage === true,
      qty: Number(item.qty) || 1,
    })
  }

  const destinationCountry = (order.shippingAddress?.country as string) || 'PT'

  const shippingResult = calculateFixedShipping({
    items: fixedItems,
    destinationCountry,
  })

  const hasCupula = shippingResult.cupulaNeedsConfirmation
  const shippingCost = shippingResult.shippingCost

  // Calcular total
  const originalSubtotal = Number(order.subtotal) || 0
  const discount = Number(order.discount) || 0

  // Para cupula: shippingCost é null (a confirmar), total = null
  const effectiveShipping = shippingCost ?? 0
  const total = hasCupula ? null : Number(((originalSubtotal - discount) + effectiveShipping).toFixed(2))

  if (total !== null && total < 0) {
    throw new NegativeTotalError(
      `Total calculado (${total}) é negativo. subtotal=${originalSubtotal}, discount=${discount}, shippingCost=${shippingCost}.`,
    )
  }

  // ════════════════════════════════════════════════════════
  // C. Iniciar transacção (shipping já está resolvido)
  // ════════════════════════════════════════════════════════

  return runInTransaction(payload, input.req, async (ctx) => {
    return executeFinalize(ctx, payload, order, input, shippingResult, shippingCost, total, items, hasCupula)
  })
}

async function executeFinalize(
  ctx: TransactionCtx,
  payload: Payload,
  order: any,
  input: PrepareOrderInput,
  shippingResult: import('./shipping/fixed-shipping').FixedShippingResult,
  shippingCost: number | null,
  total: number | null,
  items: any[],
  hasCupula: boolean,
): Promise<PrepareOrderResult> {
  // ════════════════════════════════════════════════════════
  // D. Revalidar estado da Order (dentro da transacção)
  // ════════════════════════════════════════════════════════

  const freshOrder = await payload.findByID({
    collection: 'orders',
    id: input.orderId,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  }) as any

  if (!freshOrder) {
    throw new CheckoutFinalizationError(`Order ${input.orderId} desapareceu entre leituras.`)
  }

  if (freshOrder.orderStatus !== 'draft') {
    // Se já está pending_payment ou awaiting_shipping (race condition entre leituras)
    if ((freshOrder.orderStatus === 'pending_payment' || freshOrder.orderStatus === 'awaiting_shipping') && freshOrder.checkoutAttemptId) {
      return {
        order: freshOrder,
        kind: 'already_prepared',
        checkoutAttemptId: freshOrder.checkoutAttemptId,
      }
    }
    throw new InvalidOrderStateError(
      `Order ${input.orderId} mudou para "${freshOrder.orderStatus}" desde a validação inicial.`,
      `Estado actual: ${freshOrder.orderStatus}`,
    )
  }

  // ════════════════════════════════════════════════════════
  // E. Gerar/reutilizar checkoutAttemptId
  // ════════════════════════════════════════════════════════

  let checkoutAttemptId = freshOrder.checkoutAttemptId
  if (!checkoutAttemptId) {
    checkoutAttemptId = generateCheckoutAttemptId()
  }

  // ════════════════════════════════════════════════════════
  // F. Criar reservas de stock (para cada item)
  //     CUPULA: as reservas são criadas aqui também.
  //     O estado awaiting_shipping bloqueia o pagamento
  //     até a Marina confirmar os portes.
  // ════════════════════════════════════════════════════════

  const reservations: Array<{ flowerId: number; reservationId: number; expiresAt: string }> = []

  for (const item of items) {
    const flowerId = typeof item.flower === 'object' ? item.flower.id : item.flower
    const qty = Number(item.qty) || 1
    const productionMode = item.productionMode || null

    // made_to_order: não criar reserva
    if (productionMode === 'made_to_order') {
      continue
    }

    try {
      const outcome = await reserveStock(payload, {
        flowerId,
        quantity: qty,
        checkoutAttemptId,
        req: ctx.req,
        durationMs: hasCupula ? 48 * 60 * 60 * 1000 : undefined,
      })

      if (outcome.kind === 'created' || outcome.kind === 'existing_active') {
        // Associar a reserva à Order
        await payload.update({
          collection: 'stock-reservations' as any,
          id: outcome.reservationId,
          data: { order: input.orderId } as any,
          req: ctx.req,
          overrideAccess: true,
        })

        reservations.push({
          flowerId,
          reservationId: outcome.reservationId,
          expiresAt: outcome.expiresAt,
        })
      }
    } catch (err: any) {
      // Se alguma reserva falhar, rollback completo
      throw new CheckoutFinalizationError(
        `Falha ao reservar stock para item (flowerId=${flowerId}): ${err.message}`,
      )
    }
  }

  // ════════════════════════════════════════════════════════
  // G. Guardar shipping snapshot + total
  // H. orderStatus → pending_payment (standard) ou awaiting_shipping (cupula)
  //    paymentStatus → unpaid
  // ════════════════════════════════════════════════════════

  const nextStatus = hasCupula ? 'awaiting_shipping' : 'pending_payment'

  const updatedOrder = await payload.update({
    collection: 'orders',
    id: input.orderId,
    data: {
      checkoutAttemptId,
      shippingCost: hasCupula ? null : shippingCost,
      total: hasCupula ? null : total,
      shippingProvider: hasCupula ? null : 'fixed',
      shippingServiceCode: hasCupula ? null : 'FIXED_STANDARD',
      shippingServiceName: hasCupula ? null : 'Portes Fixos Standard',
      shippingEstimatedMinDays: null,
      shippingEstimatedMaxDays: null,
      orderStatus: nextStatus,
      // paymentStatus stays 'unpaid'
    } as any,
    req: ctx.req,
    overrideAccess: true,
  })

  return {
    order: updatedOrder,
    kind: 'prepared',
    checkoutAttemptId,
  }
}