/**
 * order-fulfillment.ts — Serviço de fulfillment de Orders (ISSUE 1N)
 *
 * Responsabilidade:
 *   Permitir à Marina avançar Orders pagas através do lifecycle operacional:
 *   confirmed → processing → shipped → completed
 *
 * Regras:
 *   - Apenas transições forward no workflow fulfillment
 *   - paymentStatus deve ser "paid" para todas as transições
 *   - Timestamps são sempre server-side
 *   - trackingNumber é opcional na transição shipped
 *   - Operações repetidas são idempotentes
 *   - Concorrência segura via transacções
 *   - NUNCA altera paymentStatus, stock, ou Stripe
 */
import type { Payload } from 'payload'
import { runInTransaction, type TransactionCtx } from './transact'
import { enqueueEmailNotification, dedupKeyShipped, dedupKeyCompleted } from './email/email-notifications'
import type {
  StartProcessingInput,
  MarkShippedInput,
  CompleteOrderInput,
  FulfillmentResult,
} from './order-fulfillment-types'
import {
  InvalidOrderTransitionError,
  OrderNotPaidError,
  TrackingConflictError,
  OrderNotFoundError,
} from './order-fulfillment-types'

// ─── Estados permitidos no fulfillment ────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['processing'],
  processing: ['shipped'],
  shipped: ['completed'],
}

const ALLOWED_ORDER_STATUSES: ReadonlySet<string> = new Set([
  'confirmed', 'processing', 'shipped',
])

function now(): string {
  return new Date().toISOString()
}

function sanitizeTrackingNumber(input: string | undefined | null): string | null {
  if (!input || input.trim().length === 0) return null
  return input.trim()
}

// ═══════════════════════════════════════════════════════════════
// transitionOrderFulfillment — transição genérica
// ═══════════════════════════════════════════════════════════════

/**
 * Executa uma transição de fulfillment numa Order.
 *
 * Fluxo:
 *   1. Validar parâmetros
 *   2. Iniciar transacção
 *   3. Carregar Order actual
 *   4. Validar paymentStatus (deve ser "paid")
 *   5. Validar transição
 *   6. Verificar idempotência
 *   7. Aplicar mudanças
 *   8. Commit
 */
async function transitionOrderFulfillment(
  payload: Payload,
  input: StartProcessingInput | MarkShippedInput | CompleteOrderInput,
  targetStatus: string,
  trackingNumber?: string | null,
): Promise<FulfillmentResult> {
  return runInTransaction(payload, (input as any).req, async (ctx) => {
    // ─── 3. Carregar Order dentro da transacção ───────────────
    const order = await payload.findByID({
      collection: 'orders',
      id: input.orderId,
      depth: 0,
      req: ctx.req,
      overrideAccess: true,
    }) as any

    if (!order || !order.id) {
      throw new OrderNotFoundError(input.orderId)
    }

    const currentStatus: string = order.orderStatus || ''
    const currentPaymentStatus: string = order.paymentStatus || ''

    // ─── 4. Validar paymentStatus ─────────────────────────────
    if (currentPaymentStatus !== 'paid') {
      throw new OrderNotPaidError(input.orderId, currentPaymentStatus)
    }

    // ─── 5. Verificar idempotência (antes de validar transição) ──
    if (currentStatus === targetStatus) {
      // Se é uma tentativa de shipped com tracking diferente → conflito
      if (targetStatus === 'shipped' && trackingNumber !== undefined && trackingNumber !== null) {
        const existingTracking = order.trackingNumber as string | null | undefined
        if (existingTracking && existingTracking !== trackingNumber) {
          throw new TrackingConflictError(input.orderId, existingTracking, trackingNumber)
        }
      }
      // Já está no estado de destino
      return buildIdempotentResult(order, targetStatus)
    }

    // ─── 6. Validar transição ─────────────────────────────────
    const allowedTargets = VALID_TRANSITIONS[currentStatus]
    if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
      throw new InvalidOrderTransitionError(currentStatus, targetStatus)
    }

    // ─── 7. Aplicar mudanças ─────────────────────────────────
    const nowISO = now()
    const updateData: Record<string, any> = {
      orderStatus: targetStatus,
    }

    if (targetStatus === 'processing') {
      updateData.processingAt = nowISO
    } else if (targetStatus === 'shipped') {
      updateData.shippedAt = nowISO
      const sanitized = sanitizeTrackingNumber(trackingNumber)
      if (sanitized !== null) {
        updateData.trackingNumber = sanitized
      }
    } else if (targetStatus === 'completed') {
      updateData.completedAt = nowISO
    }

    await payload.update({
      collection: 'orders',
      id: input.orderId,
      data: updateData as any,
      req: ctx.req,
      overrideAccess: true,
    })

    // ─── 8a. Enqueue email notification (na mesma transacção) ──
    const customer = (order.customer || {}) as any
    const recipientEmail = customer.email || order.email || ''

    if (targetStatus === 'shipped' && recipientEmail) {
      try {
        const sanitized = sanitizeTrackingNumber(trackingNumber)
        await enqueueEmailNotification(payload, {
          type: 'order_shipped',
          orderId: input.orderId,
          recipientEmail,
          locale: order.locale || 'pt',
          deduplicationKey: dedupKeyShipped(input.orderId),
          snapshot: {
            type: 'order_shipped',
            data: {
              orderNumber: order.orderNumber || String(input.orderId),
              customerName: customer.name || '',
              trackingNumber: sanitized,
              shippingServiceName: order.shippingServiceName || null,
            },
          },
          req: ctx.req,
        })
      } catch {
        // Falha não aborta a transacção de fulfillment
      }
    } else if (targetStatus === 'completed' && recipientEmail) {
      try {
        await enqueueEmailNotification(payload, {
          type: 'order_completed',
          orderId: input.orderId,
          recipientEmail,
          locale: order.locale || 'pt',
          deduplicationKey: dedupKeyCompleted(input.orderId),
          snapshot: {
            type: 'order_completed',
            data: {
              orderNumber: order.orderNumber || String(input.orderId),
              customerName: customer.name || '',
            },
          },
          req: ctx.req,
        })
      } catch {
        // Falha não aborta a transacção de fulfillment
      }
    }

    // ─── 8b. Construir resultado ───────────────────────────────
    if (targetStatus === 'processing') {
      return { kind: 'processing_started', orderId: input.orderId, processingAt: nowISO }
    } else if (targetStatus === 'shipped') {
      const sanitized = sanitizeTrackingNumber(trackingNumber)
      return { kind: 'shipped', orderId: input.orderId, shippedAt: nowISO, trackingNumber: sanitized }
    } else {
      return { kind: 'completed', orderId: input.orderId, completedAt: nowISO }
    }
  })
}

function buildIdempotentResult(order: any, targetStatus: string): FulfillmentResult {
  if (targetStatus === 'processing') {
    return { kind: 'already_processing', orderId: order.id }
  } else if (targetStatus === 'shipped') {
    return { kind: 'already_shipped', orderId: order.id }
  } else {
    return { kind: 'already_completed', orderId: order.id }
  }
}

// ═══════════════════════════════════════════════════════════════
// API Pública
// ═══════════════════════════════════════════════════════════════

/**
 * Inicia o processamento de uma Order.
 * confirmed + paid → processing (com processingAt)
 */
export async function startOrderProcessing(
  payload: Payload,
  input: StartProcessingInput,
): Promise<FulfillmentResult> {
  return transitionOrderFulfillment(payload, input, 'processing')
}

/**
 * Marca uma Order como expedida.
 * processing + paid → shipped (com shippedAt + trackingNumber opcional)
 */
export async function markOrderShipped(
  payload: Payload,
  input: MarkShippedInput,
): Promise<FulfillmentResult> {
  const sanitized = sanitizeTrackingNumber(input.trackingNumber)
  return transitionOrderFulfillment(payload, input, 'shipped', sanitized)
}

/**
 * Marca uma Order como concluída.
 * shipped + paid → completed (com completedAt)
 */
export async function completeOrder(
  payload: Payload,
  input: CompleteOrderInput,
): Promise<FulfillmentResult> {
  return transitionOrderFulfillment(payload, input, 'completed')
}