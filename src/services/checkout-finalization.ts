/**
 * checkout-finalization.ts — Finalização de checkout (Issue 1F)
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
 */

import type { Payload } from 'payload'
import crypto from 'crypto'
import { getShippingQuotes, type ShippingProvider } from './shipping/shipping'
import { type ShippingQuote, type ShippingQuoteInput } from './shipping/shipping-types'
import { ShippingProviderNotConfiguredError } from './shipping/shipping-types'
import { reserveStock } from './stock'
import { runInTransaction, type TransactionCtx } from './transact'
import type {
  PrepareOrderInput,
  PrepareOrderResult,
} from './checkout-finalization-types'
import {
  CheckoutFinalizationError,
  InvalidOrderStateError,
  IncompatibleQuoteError,
  NegativeTotalError,
} from './checkout-finalization-types'

// ─── Registos de providers de shipping ──────────────────────
// Nesta ISSUE apenas FakeShippingProvider. CTT adicionado futuramente.

import { fakeProvider, fakeProviderId } from './shipping/providers/fake'

const providerRegistry: Record<string, ShippingProvider> = {
  [fakeProviderId]: fakeProvider,
}

function resolveProvider(providerId: string): ShippingProvider {
  const provider = providerRegistry[providerId]
  if (!provider) {
    throw new ShippingProviderNotConfiguredError(
      `Transportadora "${providerId}" não está configurada. Providers disponíveis: ${Object.keys(providerRegistry).join(', ')}`,
    )
  }
  return provider
}

// ─── UUID v4 generator ─────────────────────────────────────

function generateCheckoutAttemptId(): string {
  return crypto.randomUUID()
}

// ─── Construir ShippingQuoteInput a partir da Order ─────────

function buildShippingQuoteInput(order: any, subtotal: number): ShippingQuoteInput {
  const address = order.shippingAddress || {}
  const items = (order.items as any[]) || []

  // Origin: loja (Eternal Flowers)
  const origin = {
    recipientName: 'Eternal Flowers',
    line1: 'Rua das Flores, 123',
    city: 'Lisboa',
    country: 'PT',
  }

  // Destination: shipping address da Order
  const destination = {
    recipientName: address.recipientName || '',
    phone: address.phone || undefined,
    line1: address.line1 || '',
    line2: address.line2 || undefined,
    city: address.city || '',
    region: address.region || undefined,
    postalCode: address.postalCode || undefined,
    country: address.country || 'PT',
  }

  // Parcels: um por item (estimativa simples)
  const parcels = items.map(() => ({ weight: 1.0 }))

  return {
    origin,
    destination,
    parcels,
    currency: order.currency || 'EUR',
    orderValue: subtotal,
  }
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
  // B. Obter shipping quote FORA da transacção
  // ════════════════════════════════════════════════════════

  const provider = resolveProvider(input.shippingProviderId)

  const quoteInput = buildShippingQuoteInput(order, subtotal)
  let quotes: ShippingQuote[]

  try {
    quotes = await getShippingQuotes(provider, quoteInput)
  } catch (err) {
    // Se provider não configurado, propaga — Order continua draft
    if (err instanceof ShippingProviderNotConfiguredError) {
      throw err
    }
    // Outros erros de shipping
    throw new CheckoutFinalizationError(
      `Erro ao obter cotações: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
    )
  }

  // Encontrar a cotação escolhida pelo serviceCode
  const selectedQuote = quotes.find((q) => q.serviceCode === input.shippingServiceCode)
  if (!selectedQuote) {
    throw new IncompatibleQuoteError(
      `Serviço "${input.shippingServiceCode}" não encontrado nas cotações do provider "${input.shippingProviderId}".`,
    )
  }

  const shippingCost = selectedQuote.amount

  // Validar shippingCost (segurança — rejeitar negativo/inválido)
  if (typeof shippingCost !== 'number' || shippingCost < 0) {
    throw new IncompatibleQuoteError('Cotação de envio inválida (valor negativo ou não numérico).')
  }

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
    return executeFinalize(ctx, payload, order, input, selectedQuote, shippingCost, total, items)
  })
}

async function executeFinalize(
  ctx: TransactionCtx,
  payload: Payload,
  order: any,
  input: PrepareOrderInput,
  selectedQuote: ShippingQuote,
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
      shippingProvider: selectedQuote.provider,
      shippingServiceCode: selectedQuote.serviceCode,
      shippingServiceName: selectedQuote.serviceName,
      shippingEstimatedMinDays: selectedQuote.estimatedMinDays ?? null,
      shippingEstimatedMaxDays: selectedQuote.estimatedMaxDays ?? null,
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