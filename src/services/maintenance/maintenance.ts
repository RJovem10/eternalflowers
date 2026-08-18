/**
 * maintenance.ts — Runner seguro de manutenção operacional
 *
 * Responsabilidade:
 *   Executa sequencialmente as rotinas de manutenção existentes:
 *     1. expireAbandonedPendingOrders()  — expirar Orders pending_payment
 *     2. processPendingEmailNotifications() — processar outbox de emails
 *
 * Ordem deliberada:
 *   primeiro reconciliar/expirar Orders e reservas;
 *   depois processar notifications pendentes.
 *
 * NÃO mistura transactions dos dois subsistemas.
 * NÃO altera regras de negócio de nenhum subsistema.
 * NÃO expõe PII, secrets ou raw provider errors na resposta.
 */
import type { Payload } from 'payload'
import { expireAbandonedPendingOrders } from '@/services/order-lifecycle'
import { processPendingEmailNotifications } from '@/services/email/email-notifications'
import { getConfiguredEmailProvider } from '@/services/email/get-email-provider'
import { EmailProviderNotConfiguredError } from '@/services/email/email-provider-errors'

// ─── Tipos públicos ───────────────────────────────────────────

export interface AbandonedOrdersSummary {
  total: number
  expired: number
  skipped: number
  errors: number
}

export interface EmailNotificationsSummary {
  processed: number
  sent: number
  failed: number
  skipped: number
  errors: number
  /** true se provider não estava configurado */
  providerNotConfigured: boolean
}

export interface MaintenanceSummary {
  abandonedOrders: AbandonedOrdersSummary
  emailNotifications: EmailNotificationsSummary
}

// ─── Lock de concorrência in-process ───────────────────────────

let _isRunning = false

/**
 * true se um ciclo de manutenção está em execução neste processo.
 * Usado pelo endpoint para devolver 409.
 */
export function isMaintenanceRunning(): boolean {
  return _isRunning
}

// ═══════════════════════════════════════════════════════════════
// runMaintenanceCycle
// ═══════════════════════════════════════════════════════════════

/**
 * Executa um ciclo completo de manutenção.
 *
 * 1. expireAbandonedPendingOrders() — expira Orders pending_payment
 * 2. processPendingEmailNotifications() — processa outbox de emails
 *
 * Retorna resumo sanitizado — sem PII, secrets, Stripe IDs ou
 * raw provider errors.
 *
 * @throws Se já estiver a correr (concorrência). O endpoint trata.
 */
export async function runMaintenanceCycle(
  payload: Payload,
): Promise<MaintenanceSummary> {
  if (_isRunning) {
    throw new MaintenanceAlreadyRunningError()
  }

  _isRunning = true

  try {
    // ─── Fase A: Expirar Orders abandonadas ──────────────────
    const abandonedOrders = await runAbandonedOrders(payload)

    // ─── Fase B: Processar notificações de email ─────────────
    const emailNotifications = await runEmailNotifications(payload)

    return {
      abandonedOrders,
      emailNotifications,
    }
  } finally {
    _isRunning = false
  }
}

// ─── Fase A ───────────────────────────────────────────────────

async function runAbandonedOrders(
  payload: Payload,
): Promise<AbandonedOrdersSummary> {
  try {
    const result = await expireAbandonedPendingOrders(payload)

    return {
      total: result.total,
      expired: result.expired,
      skipped: result.skipped,
      errors: result.errors,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    // Log sanitizado — sem PII, sem secrets
    console.error('[maintenance] expireAbandonedPendingOrders failed:', msg)

    return {
      total: 0,
      expired: 0,
      skipped: 0,
      errors: 1,
    }
  }
}

// ─── Fase B ───────────────────────────────────────────────────

async function runEmailNotifications(
  payload: Payload,
): Promise<EmailNotificationsSummary> {
  // Resolver provider
  let provider
  try {
    provider = await getConfiguredEmailProvider()
  } catch (err: unknown) {
    if (err instanceof EmailProviderNotConfiguredError) {
      // Provider não configurado — não é erro, apenas skip
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: 0,
        providerNotConfigured: true,
      }
    }
    // Erro inesperado na factory
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[maintenance] getConfiguredEmailProvider failed:', msg)
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: 1,
      providerNotConfigured: false,
    }
  }

  try {
    const result = await processPendingEmailNotifications(payload, {
      provider,
      // batch limit seguro — mesmo que o endpoint admin
      batchLimit: 20,
    })

    return {
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors,
      providerNotConfigured: false,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    // Log sanitizado — sem PII, sem secrets, sem email bodies
    console.error('[maintenance] processPendingEmailNotifications failed:', msg)
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: 1,
      providerNotConfigured: false,
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Erro de concorrência
// ═══════════════════════════════════════════════════════════════

export class MaintenanceAlreadyRunningError extends Error {
  readonly name = 'MaintenanceAlreadyRunningError'

  constructor() {
    super('Um ciclo de manutenção já está em execução neste processo.')
  }
}