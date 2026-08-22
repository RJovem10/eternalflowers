import type { Payload } from 'payload'
import { lockOrderForUpdate } from './db-adapter'
import { runInTransactionWithRetry } from './transact'
import { validateActiveOrderReservations } from './payments/payment-links'

export class CupulaShippingConfirmationError extends Error {
  code = 'CUPULA_SHIPPING_CONFIRMATION_ERROR' as const
  constructor(message: string) {
    super(message)
    this.name = 'CupulaShippingConfirmationError'
  }
}

export interface ConfirmCupulaShippingInput {
  orderId: number
  quoteAmountCents: number
  reference?: string
  confirmed: boolean
  confirmedBy: number | string
  req?: any
}

export async function confirmCupulaShippingQuote(
  payload: Payload,
  input: ConfirmCupulaShippingInput,
): Promise<{ kind: 'confirmed' | 'already_confirmed'; order: any }> {
  if (input.confirmed !== true) {
    throw new CupulaShippingConfirmationError('É necessária confirmação explícita dos portes.')
  }
  if (!Number.isInteger(input.quoteAmountCents) || input.quoteAmountCents < 0 || input.quoteAmountCents > 100_000) {
    throw new CupulaShippingConfirmationError('Valor de portes inválido.')
  }
  if (input.reference && input.reference.length > 500) {
    throw new CupulaShippingConfirmationError('A referência dos portes não pode exceder 500 caracteres.')
  }
  if (input.confirmedBy === undefined || input.confirmedBy === null || input.confirmedBy === '') {
    throw new CupulaShippingConfirmationError('Administrador responsável não identificado.')
  }

  return runInTransactionWithRetry(payload, input.req, async (ctx) => {
    await lockOrderForUpdate(ctx, input.orderId)
    const order = await payload.findByID({
      collection: 'orders',
      id: input.orderId,
      depth: 0,
      req: ctx.req,
      overrideAccess: true,
    }) as any
    if (!order?.id) throw new CupulaShippingConfirmationError('Encomenda não encontrada.')

    const shippingCost = input.quoteAmountCents / 100
    const reference = input.reference?.trim() || null
    if (order.orderStatus === 'pending_payment' && order.shippingConfirmedAt) {
      if (
        Number(order.shippingCost) === shippingCost &&
        String(order.shippingQuoteReference || '') === String(reference || '')
      ) {
        return { kind: 'already_confirmed', order }
      }
      throw new CupulaShippingConfirmationError('Os portes já foram confirmados com outros dados.')
    }

    if (order.orderStatus !== 'awaiting_shipping' || order.paymentStatus !== 'unpaid') {
      throw new CupulaShippingConfirmationError('A encomenda não está a aguardar confirmação de portes.')
    }
    if (order.stripePaymentIntentId) {
      throw new CupulaShippingConfirmationError('Já existe um pagamento Stripe associado.')
    }

    // Manual orders não têm stock reservations para validar
    if (order.orderSource !== 'manual') {
      await validateActiveOrderReservations(payload, order, new Date(), ctx.req)
    }
    const subtotal = Number(order.subtotal)
    const discount = Number(order.discount) || 0
    const total = Number((subtotal - discount + shippingCost).toFixed(2))
    if (!Number.isFinite(subtotal) || subtotal <= 0 || total < 0) {
      throw new CupulaShippingConfirmationError('Não foi possível calcular o total da encomenda.')
    }

    const now = new Date().toISOString()
    const updated = await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        shippingCost,
        total,
        shippingProvider: 'manual_quote',
        shippingServiceCode: 'CUPULA_CONFIRMED',
        shippingServiceName: 'Portes de Cúpula Confirmados',
        shippingQuoteReference: reference,
        shippingConfirmedAt: now,
        shippingConfirmedBy: input.confirmedBy,
        orderStatus: 'pending_payment',
      } as any,
      req: ctx.req,
      overrideAccess: true,
      depth: 0,
    })
    return { kind: 'confirmed', order: updated }
  })
}
