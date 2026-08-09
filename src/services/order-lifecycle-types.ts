/**
 * order-lifecycle-types.ts — Contratos de domínio para lifecycle de Orders
 *
 * Define inputs, outcomes e erros para o serviço de expiração de
 * Orders abandonadas (ISSUE 1L).
 */

// ─── Options ──────────────────────────────────────────────────

export interface ExpireAbandonedOptions {
  /** Momento de referência. Injectável para testes. Default: new Date() */
  now?: Date
}

// ─── Resultados por Order ─────────────────────────────────────

export type OrderLifecycleResult =
  // Order expirada com sucesso
  | {
      kind: 'expired'
      orderId: number
      expiredReservationCount: number
      releasedReservationCount: number
      paymentIntentCancelled: boolean
    }
  // made_to_order-only — sem reservas físicas para expirar
  | { kind: 'skipped_made_to_order_only'; orderId: number }
  // Reserva está confirmed inesperadamente numa Order ainda pending_payment
  | { kind: 'skipped_inconsistent_confirmed_reservation'; orderId: number }
  // PaymentIntent está processing — não expirar, deixar webhook resolver
  | { kind: 'skipped_pi_processing'; orderId: number }
  // PaymentIntent já succeeded — não expirar, deixar webhook resolver
  | { kind: 'skipped_pi_succeeded'; orderId: number }
  // Order já não é candidate (mudou estado entre a listagem e o processamento)
  | { kind: 'skipped_not_candidate'; orderId: number; reason: string }
  // Todas as reservas ainda válidas — nada a fazer
  | { kind: 'skipped_reservations_valid'; orderId: number }
  // Erro inesperado no processamento
  | { kind: 'error'; orderId: number; error: string }

// ─── Sumário ──────────────────────────────────────────────────

export interface ExpireAbandonedSummary {
  /** Total de Orders avaliadas */
  total: number
  /** Total de Orders expiradas com sucesso */
  expired: number
  /** Total de Orders ignoradas */
  skipped: number
  /** Total de Orders com erro */
  errors: number
  /** Detalhe por Order */
  details: OrderLifecycleResult[]
}