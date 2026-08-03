/**
 * transact.ts — Helper transacional Payload
 *
 * Uso:
 *   const result = await runInTransaction(payload, req, async (ctx) => {
 *     const doc = await payload.create({ collection: 'x', data: {...}, req: ctx.req })
 *     return doc
 *   })
 *   // Se a callback retornar sem erro → COMMIT
 *   // Se lançar erro → ROLLBACK
 */
import { initTransaction } from 'payload'

export interface TransactionCtx {
  req: any
  ownsTransaction: boolean
}

/**
 * Executa uma callback dentro de uma transacção Payload.
 *
 * - Reutiliza transactionID existente se presente em req
 * - Só inicia nova transacção se necessário
 * - Só faz commit/rollback quando é proprietário
 * - Erros da callback propagam (o proprietário exterior decide)
 * - Outcomes normais fazem commit
 */
export async function runInTransaction<T>(
  payload: any,
  req: any | undefined,
  fn: (ctx: TransactionCtx) => Promise<T>,
): Promise<T> {
  const ctx: TransactionCtx = {
    req: req || { payload, transactionID: undefined },
    ownsTransaction: false,
  }

  if (!ctx.req.payload) ctx.req.payload = payload

  ctx.ownsTransaction = await initTransaction(ctx.req)

  try {
    const result = await fn(ctx)
    if (ctx.ownsTransaction) {
      await payload.db.commitTransaction(ctx.req.transactionID)
    }
    return result
  } catch (err) {
    if (ctx.ownsTransaction) {
      try {
        await payload.db.rollbackTransaction(ctx.req.transactionID)
      } catch {
        // Silencioso — o erro original é o importante
      }
    }
    throw err
  }
}

/**
 * Versão com retry para SQLite.
 * Executa runInTransaction até 3 vezes quando SQLITE_BUSY é detectado.
 * Apenas faz retry quando é proprietário da transacção (não aninhado).
 */
export async function runInTransactionWithRetry<T>(
  payload: any,
  req: any | undefined,
  fn: (ctx: TransactionCtx) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  const ctx: TransactionCtx = {
    req: req || { payload, transactionID: undefined },
    ownsTransaction: false,
  }

  if (!ctx.req.payload) ctx.req.payload = payload
  ctx.ownsTransaction = await initTransaction(ctx.req)

  // Se já existe transacção exterior, não fazer retry
  if (!ctx.ownsTransaction) {
    return runInTransaction(payload, req, fn)
  }

  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Backoff com jitter: 200ms ± 50ms, 400ms ± 50ms, 600ms ± 50ms
      const baseDelay = 200 * attempt
      const jitter = Math.round(Math.random() * 100 - 50)
      await new Promise((r) => setTimeout(r, baseDelay + jitter))

      // Nova transacção para cada retry
      ctx.ownsTransaction = await initTransaction(ctx.req)
    }

    try {
      const result = await fn(ctx)
      if (ctx.ownsTransaction) {
        await payload.db.commitTransaction(ctx.req.transactionID)
      }
      return result
    } catch (err: any) {
      lastError = err

      if (ctx.ownsTransaction) {
        try {
          await payload.db.rollbackTransaction(ctx.req.transactionID)
        } catch {}
      }

      // Só retry para SQLITE_BUSY
      if (!isSQLiteBusyError(err)) throw err
    }
  }

  // Esgotaram as tentativas
  throw createStockBusyError(lastError)
}

function isSQLiteBusyError(err: any): boolean {
  const msg = err?.message || ''
  return msg.includes('SQLITE_BUSY') || msg.includes('database is locked')
}

function createStockBusyError(original: unknown): Error {
  const err = new Error('Base de dados ocupada após várias tentativas.') as any
  err.code = 'STOCK_BUSY_RETRY'
  err.cause = original
  return err
}