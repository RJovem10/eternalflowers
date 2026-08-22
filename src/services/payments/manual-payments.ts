import type { Payload } from 'payload'
import {
  EXTERNAL_PAYMENT_METHODS,
  PaymentSettlementConflictError,
  settleOrderPayment,
  type ExternalPaymentMethod,
  type SettleOrderPaymentResult,
} from './payment-settlement'

export interface ConfirmExternalPaymentInput {
  orderId: number
  method: ExternalPaymentMethod
  reference?: string
  confirmed: boolean
  confirmedBy: number | string
  req?: any
}

/**
 * Comando administrativo explícito. Não aceita total, estado ou provider do
 * browser; esses valores são determinados pelo settlement a partir da Order.
 */
export async function confirmExternalPayment(
  payload: Payload,
  input: ConfirmExternalPaymentInput,
): Promise<SettleOrderPaymentResult> {
  if (input.confirmed !== true) {
    throw new PaymentSettlementConflictError('É necessária confirmação explícita do pagamento recebido.')
  }
  if (!EXTERNAL_PAYMENT_METHODS.includes(input.method)) {
    throw new PaymentSettlementConflictError('Método de pagamento externo inválido.')
  }
  if (input.reference && input.reference.length > 500) {
    throw new PaymentSettlementConflictError('A referência de pagamento não pode exceder 500 caracteres.')
  }
  if (input.confirmedBy === undefined || input.confirmedBy === null || input.confirmedBy === '') {
    throw new PaymentSettlementConflictError('Não foi possível identificar o administrador que confirmou o pagamento.')
  }

  return settleOrderPayment(payload, {
    orderId: input.orderId,
    payment: {
      provider: 'manual',
      paymentMethodType: input.method,
      reference: input.reference,
      confirmedBy: input.confirmedBy,
    },
    req: input.req,
  })
}
