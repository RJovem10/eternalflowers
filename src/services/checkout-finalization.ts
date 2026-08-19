/**
 * checkout-finalization.ts — Finalização de checkout (Issue 1F / 1J)
 *
 * Responsabilidades:
 * - Cotação de shipping server-side (nunca confia no cliente)
 * - Cálculo do total final
 * - Criação idempotente das reservas de stock
 * - Transição draft → pending_payment
 *
 * Fluxo:
 *   A. Carregar/validar Order (fora da transacção)
 *   B. Obter shipping quote FORA da transacção
 *   C. Iniciar transacção
 *   D. Revalidar estado da Order
 *   E. Persistir checkoutAttemptId se necessário
 *   F. Criar/reutilizar reservas
 *   G. Guardar shipping snapshot + total
 *   H. orderStatus → pending_payment
 *   I. paymentStatus continua unpaid
 *   J. Commit
 *
 * Segurança:
 * - provider, parcel e origin são recebidos server-side (nunca do browser)
 * - parcel é validado antes de qualquer chamada ao provider
 * - sem parcel válido → Order continua draft, 0 reservas
 * - sem provider configurado → Order continua draft, 0 reservas
 * - shippingCost vem exclusivamente da quote do provider
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
  ShippingParcelNotConfiguredError,
  InvalidShippingParcelError,
  CupulaShippingNeedsConfirmationError,
} from './checkout-finalization-types'

// ─── UUID v4 generator ─────────────────────────────────────

function generateCheckoutAttemptId(): string {
  return crypto.randomUUID()
}

// ─── Validação do parcel server-side ────────────────────────

function validateParcel(parcel: unknown): asserts parcel is ShippingParcel {
  if (parcel === null || parcel === undefined) {
    throw new ShippingParcelNotConfiguredError(
      'Parcel de envio não foi fornecido. É necessário fornecer um parcel com peso real.',
    )
  }

  if (typeof parcel !== 'object') {
    throw new InvalidShippingParcelError(
      'Parcel de envio inválido.',
      'parcel deve ser um objecto.',
    )
  }

  const p = parcel as Record<string, unknown>

  if (typeof p.weight !== 'number' || p.weight <= 0) {
    throw new InvalidShippingParcelError(
      'Parcel de envio inválido.',
      'parcel.weight deve ser um número positivo.',
    )
  }

  if (p.length !== undefined && (typeof p.length !== 'number' || p.length <= 0)) {
    throw new InvalidShippingParcelError(
      'Parcel de envio inválido.',
      'parcel.length deve ser um número positivo ou omitido.',
    )
  }

  if (p.width !== undefined && (typeof p.width !== 'number' || p.width <= 0)) {
    throw new InvalidShippingParcelError(
      'Parcel de envio inválido.',
      'parcel.width deve ser um número positivo ou omitido.',
    )
  }

  if (p.height !== undefined && (typeof p.height !== 'number' || p.height <= 0)) {
    throw new InvalidShippingParcelError(
      'Parcel de envio inválido.',
      'parcel.height deve ser um número positivo ou omitido.',
    )
  }
}

// ─── Prepare Order For Payment ──────────────────────────────

export async function prepareOrderForPayment(
  payload: Payload,
  input: PrepareOrderInput,
): Promise<PrepareOrderResult> {
  // ════════════════════════════════════════════════════════
  // 0. Validar parcel server-side (antes de qualquer IO)
  // ════════════════════════════════════════════════════════
  validateParcel(input.parcel)

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
  if (order.orderStatus === 'pending_payment') {
    // Já finalizada: devolver resultado existente
    if (!order.checkoutAttemptId) {
      // Estado inconsistente — checkoutAttemptId devia existir
      throw new InvalidOrderStateError(
        `Order ${input.orderId} está pending_payment sem checkoutAttemptId.`,
        'Estado inconsistente: pending_payment sem checkoutAttemptId.',
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
      productSubtotal: subtotal,
    })

    // Se cúpula necessita de confirmação manual, não avança para pending_payment
    if (shippingResult.cupulaNeedsConfirmation) {
      throw new CupulaShippingNeedsConfirmationError(
        'Encomenda com cúpula — portes de envio a confirmar após reserva manual.',
      )
    }

    const shippingCost = shippingResult.shippingCost

    // Calcular total
    const originalSubtotal = Number(order.subtotal) || 0
    const discount = Number(order.discount) || 0
    const total = Number(((originalSubtotal - discount) + shippingCost).toFixed(2))

    if (total < 0) {
      throw new NegativeTotalError(
        `Total calculado (${total}) é negativo. subtotal=${originalSubtotal}, discount=${discount}, shippingCost=${shippingCost}.`,
      )
    }

    // ════════════════════════════════════════════════════════
    // C. Iniciar transacção (shipping já está resolvido)
    // ════════════════════════════════════════════════════════

    return runInTransaction(payload, input.req, async (ctx) => {
      return executeFinalize(ctx, payload, order, input, shippingResult, shippingCost, total, items)
    })
  }

  async function executeFinalize(
    ctx: TransactionCtx,
    payload: Payload,
    order: any,
    input: PrepareOrderInput,
    shippingResult: import('./shipping/fixed-shipping').FixedShippingResult,
    shippingCost: number,
    total: number,
    items: any[],
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
    // Se já está pending_payment (race condition entre leituras)
    if (freshOrder.orderStatus === 'pending_payment' && freshOrder.checkoutAttemptId) {
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

    // productionMode null/legacy: só reservar se o stock service aceitar
    // O stock service já tem as suas próprias regras — chamamos reserveStock
    // que lança ProductNotReservableError se não puder reservar.
    try {
      const outcome = await reserveStock(payload, {
        flowerId,
        quantity: qty,
        checkoutAttemptId,
        req: ctx.req,
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
      // A transacção é gerida pelo runInTransaction — lançar erro faz rollback
      throw new CheckoutFinalizationError(
        `Falha ao reservar stock para item (flowerId=${flowerId}): ${err.message}`,
      )
    }
  }

  // ════════════════════════════════════════════════════════
  // G. Guardar shipping snapshot + total
  // ════════════════════════════════════════════════════════
  // H. orderStatus → pending_payment, paymentStatus → unpaid
  // ════════════════════════════════════════════════════════

  const updatedOrder = await payload.update({
    collection: 'orders',
    id: input.orderId,
    data: {
      checkoutAttemptId,
      shippingCost,
      total,
      shippingProvider: 'fixed',
      shippingServiceCode: shippingResult.isFree ? 'FREE' : 'FIXED_STANDARD',
      shippingServiceName: shippingResult.isFree
        ? 'Portes Grátis'
        : 'Portes Fixos Standard',
      shippingEstimatedMinDays: null,
      shippingEstimatedMaxDays: null,
      orderStatus: 'pending_payment',
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