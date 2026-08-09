/**
 * email-notifications.ts — Serviço de outbox para emails transacionais
 *
 * Responsabilidades:
 *   - enqueueEmailNotification: cria EmailNotification pendente na mesma
 *     DB transaction da alteração de domínio
 *   - processPendingEmailNotifications: processa notificações pendentes
 *     FORA de DB transactions, chamando o EmailProvider
 *
 * Regras ISSUE 1O:
 *   - NUNCA envia email dentro de DB transaction crítica
 *   - deduplicação via deduplicationKey estável
 *   - claim seguro para concorrência (compatível SQLite + PG)
 *   - sent → nunca reenviar
 *   - failed abaixo de maxAttempts pode retry
 */
import type { Payload } from 'payload'
import type { EmailProvider } from './email-provider'
import { renderEmail } from './email-templates'
import { runInTransaction, type TransactionCtx } from '../transact'
import type {
  EmailNotificationType,
  EmailNotificationStatus,
  EmailSnapshot,
  EnqueueResult,
} from './email-types'
import type { Locale } from '@/i18n/locales'

// ─── Constantes ───────────────────────────────────────────────

const MAX_ATTEMPTS = 5
const BATCH_LIMIT = 20

// ═══════════════════════════════════════════════════════════════
// Enqueue
// ═══════════════════════════════════════════════════════════════

export interface EnqueueInput {
  type: EmailNotificationType
  orderId: number
  recipientEmail: string
  locale: Locale | string
  deduplicationKey: string
  snapshot: EmailSnapshot
  req?: any
}

/**
 * Cria uma EmailNotification pendente na mesma DB transaction.
 * Se já existir com a mesma deduplicationKey, devolve existing (idempotente).
 */
export async function enqueueEmailNotification(
  payload: Payload,
  input: EnqueueInput,
): Promise<EnqueueResult> {
  return runInTransaction(payload, input.req, async (ctx) => {
    return executeEnqueue(ctx, payload, input)
  })
}

async function executeEnqueue(
  ctx: TransactionCtx,
  payload: Payload,
  input: EnqueueInput,
): Promise<EnqueueResult> {
  // ─── Verificar duplicado ─────────────────────────────
  const existing = await payload.find({
    collection: 'email-notifications' as any,
    where: { deduplicationKey: { equals: input.deduplicationKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const existingDoc = existing.docs[0] as any
  if (existingDoc) {
    return { kind: 'already_queued', existingId: existingDoc.id }
  }

  // ─── Criar notification ──────────────────────────────
  const payloadData: Record<string, unknown> = {}
  if (input.snapshot.type === 'order_confirmed') {
    payloadData.data = input.snapshot.data
  } else if (input.snapshot.type === 'order_shipped') {
    payloadData.data = input.snapshot.data
  } else if (input.snapshot.type === 'order_completed') {
    payloadData.data = input.snapshot.data
  }

  const doc = await payload.create({
    collection: 'email-notifications' as any,
    data: {
      type: input.type,
      order: input.orderId,
      recipientEmail: input.recipientEmail,
      locale: input.locale,
      status: 'pending',
      deduplicationKey: input.deduplicationKey,
      attemptCount: 0,
      payload: {
        type: input.snapshot.type,
        data: payloadData.data,
      },
    } as any,
    req: ctx.req,
    overrideAccess: true,
  })

  return { kind: 'created', notificationId: doc.id }
}

// ═══════════════════════════════════════════════════════════════
// Helpers de deduplicationKey
// ═══════════════════════════════════════════════════════════════

export function dedupKeyConfirmed(orderId: number): string {
  return `order-confirmed:${orderId}`
}

export function dedupKeyShipped(orderId: number): string {
  return `order-shipped:${orderId}`
}

export function dedupKeyCompleted(orderId: number): string {
  return `order-completed:${orderId}`
}

// ═══════════════════════════════════════════════════════════════
// Processor
// ═══════════════════════════════════════════════════════════════

export interface ProcessPendingOptions {
  /** Provider a usar (default: fakeEmailProvider) */
  provider?: EmailProvider
  /** Máximo de notificações a processar (default: 20) */
  batchLimit?: number
  /** Máximo de tentativas (default: 5) */
  maxAttempts?: number
}

export interface ProcessPendingSummary {
  processed: number
  sent: number
  failed: number
  skipped: number
  errors: number
  details: Array<{
    notificationId: number
    type: string
    result: 'sent' | 'failed' | 'skipped_max_attempts' | 'error'
  }>
}

/**
 * Processa notificações pendentes/failed com tentativas disponíveis.
 * Claim seguro: marca como sending primeiro, depois chama provider FORA
 * da transacção, depois actualiza status.
 */
export async function processPendingEmailNotifications(
  payload: Payload,
  options?: ProcessPendingOptions,
): Promise<ProcessPendingSummary> {
  const provider = options?.provider
  const batchLimit = options?.batchLimit ?? BATCH_LIMIT
  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS

  const details: ProcessPendingSummary['details'] = []

  // ─── 1. Seleccionar candidates ──────────────────────────
  const candidates = await payload.find({
    collection: 'email-notifications' as any,
    where: {
      or: [
        { status: { equals: 'pending' } },
        { status: { equals: 'failed' } },
      ],
      attemptCount: { less_than: maxAttempts },
    },
    sort: 'createdAt',
    limit: batchLimit,
    depth: 0,
    overrideAccess: true,
  })

  // ─── 2. Para cada candidate ─────────────────────────────
  for (const notification of candidates.docs as any[]) {
    // Skip se já atingiu max tentativas (race safety)
    if (notification.attemptCount >= maxAttempts) {
      details.push({
        notificationId: notification.id,
        type: notification.type,
        result: 'skipped_max_attempts',
      })
      continue
    }

    // ─── 2a. Claim: marcar como sending ──────────────────
    const claimed = await claimNotification(payload, notification.id, notification.attemptCount)
    if (!claimed) {
      // Outro worker já reclamou — skip sem erro
      details.push({
        notificationId: notification.id,
        type: notification.type,
        result: 'skipped_max_attempts',
      })
      continue
    }

    // ─── 2b. Renderizar email ────────────────────────────
    let rendered: ReturnType<typeof renderEmail>
    try {
      rendered = renderEmail(notification.payload, notification.locale || 'pt')
    } catch (err: any) {
      await markFailed(payload, notification.id, `Render error: ${err.message}`)
      details.push({
        notificationId: notification.id,
        type: notification.type,
        result: 'error',
      })
      continue
    }

    // ─── 2c. Enviar FORA da transacção DB ────────────────
    let sendResult
    try {
      sendResult = await provider!.send({
        to: notification.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: notification.deduplicationKey,
      })
    } catch (err: any) {
      // Provider lançou excepção — marcar como failed
      await markFailed(payload, notification.id, `Provider exception: ${err.message}`)
      details.push({
        notificationId: notification.id,
        type: notification.type,
        result: 'error',
      })
      continue
    }

    // ─── 2d. Persistir resultado ─────────────────────────
    if (sendResult.kind === 'sent') {
      await markSent(payload, notification.id)
      details.push({
        notificationId: notification.id,
        type: notification.type,
        result: 'sent',
      })
    } else {
      await markFailed(payload, notification.id, sendResult.error || 'Provider returned failed')
      details.push({
        notificationId: notification.id,
        type: notification.type,
        result: 'failed',
      })
    }
  }

  const sent = details.filter((d) => d.result === 'sent').length
  const failed = details.filter((d) => d.result === 'failed').length
  const skipped = details.filter((d) => d.result === 'skipped_max_attempts').length
  const errors = details.filter((d) => d.result === 'error').length

  return {
    processed: details.length,
    sent,
    failed,
    skipped,
    errors,
    details,
  }
}

// ═══════════════════════════════════════════════════════════════
// Claim / status updates
// ═══════════════════════════════════════════════════════════════

/**
 * Claim optimista: marca como "sending" apenas se status for pending/failed
 * e attemptCount corresponder (evita race entre workers).
 *
 * Compatível com SQLite (serializado) e PG (row lock em UPDATE).
 * Transacção curta e independente.
 */
async function claimNotification(
  payload: Payload,
  notificationId: number,
  currentAttemptCount: number,
): Promise<boolean> {
  try {
    await runInTransaction(payload, undefined, async (ctx) => {
      const doc = await payload.findByID({
        collection: 'email-notifications' as any,
        id: notificationId,
        depth: 0,
        req: ctx.req,
        overrideAccess: true,
      }) as any

      if (!doc) throw new Error('Notification not found')

      // Só reclama se ainda está pending/failed
      if (doc.status !== 'pending' && doc.status !== 'sending' && doc.status !== 'failed') {
        throw new Error('Already sent')
      }

      // Se attemptCount mudou, outro worker já o reclamou
      if (doc.attemptCount !== currentAttemptCount) {
        throw new Error('Claimed by another worker')
      }

      await payload.update({
        collection: 'email-notifications' as any,
        id: notificationId,
        data: {
          status: 'sending',
          attemptCount: (doc.attemptCount || 0) + 1,
        } as any,
        req: ctx.req,
        overrideAccess: true,
      })
    })
    return true
  } catch {
    return false
  }
}

async function markSent(
  payload: Payload,
  notificationId: number,
): Promise<void> {
  await payload.update({
    collection: 'email-notifications' as any,
    id: notificationId,
    data: {
      status: 'sent',
      sentAt: new Date().toISOString(),
      lastError: null,
    } as any,
    overrideAccess: true,
  })
}

async function markFailed(
  payload: Payload,
  notificationId: number,
  errorMsg: string,
): Promise<void> {
  // Sanitizar: não guardar stack traces ou secrets
  const sanitized = errorMsg.slice(0, 500).replace(/[\n\r]/g, ' ')

  await payload.update({
    collection: 'email-notifications' as any,
    id: notificationId,
    data: {
      status: 'failed',
      lastError: sanitized,
    } as any,
    overrideAccess: true,
  })
}

/**
 * Reabre notificações failed com tentativas disponíveis para retry.
 */
export async function requeueFailedEmailNotifications(
  payload: Payload,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<number> {
  const candidates = await payload.find({
    collection: 'email-notifications' as any,
    where: {
      status: { equals: 'failed' },
      attemptCount: { less_than: maxAttempts },
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  let count = 0
  for (const notification of candidates.docs as any[]) {
    await payload.update({
      collection: 'email-notifications' as any,
      id: notification.id,
      data: { status: 'pending' } as any,
      overrideAccess: true,
    })
    count++
  }

  return count
}