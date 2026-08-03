/**
 * db-adapter.ts — Abstração de base de dados para stock e reservas
 *
 * Único ficheiro que acede directamente a payload.db.sessions[transactionID].
 * Isole diferenças entre PostgreSQL (FOR UPDATE, SUM SQL) e SQLite (run, paginação).
 */
import { sql } from 'drizzle-orm'
import type { TransactionCtx } from './transact'

export type AdapterName = 'postgres' | 'sqlite'

/**
 * Detecta o nome do adapter a partir do payload.db.
 * NOTA: NÃO assumir que db.name está sempre disponível.
 * Usar heurística: se sessions[id].db.execute existe → postgres, caso contrário sqlite.
 */
function getAdapterName(ctx: TransactionCtx): AdapterName {
  const db = ctx.req.payload.db as any
  return db.name === 'postgres' ? 'postgres' : 'sqlite'
}

/**
 * Obtém a sessão transacional drizzle.
 * Lança erro se a sessão não existir (impede operação sem lock).
 */
function getTransactionalSession(ctx: TransactionCtx): any {
  const db = ctx.req.payload.db as any
  const tid = ctx.req.transactionID instanceof Promise
    ? ctx.req.transactionID
    : ctx.req.transactionID

  const session = db.sessions?.[tid]
  if (!session?.db) {
    throw new Error('STOCK_BUSY_RETRY: sessão transacional não disponível')
  }
  return session.db
}

/**
 * Bloqueia a linha da flower para escrita.
 * PostgreSQL: SELECT ... FOR UPDATE na sessão drizzle.
 * SQLite: lock implícito na transacção — nenhuma acção adicional.
 */
export async function lockFlowerForUpdate(ctx: TransactionCtx, flowerId: number): Promise<void> {
  const adapter = getAdapterName(ctx)

  if (adapter === 'postgres') {
    const sessionDb = getTransactionalSession(ctx)
    if (typeof sessionDb.execute !== 'function') {
      throw new Error('STOCK_BUSY_RETRY: sessão PG sem método execute')
    }
    await sessionDb.execute(sql`SELECT id FROM flowers WHERE id = ${flowerId} FOR UPDATE`)
  }
  // SQLite: o lock é implícito na transacção serializada
}

/**
 * Soma a quantidade reservada activa para uma flower.
 * Executa dentro da transacção, após lock da flower.
 * PostgreSQL: SUM SQL directo na sessão.
 * SQLite: paginação completa via Payload Local API (serializado pela transacção).
 */
export async function sumActiveReservedQuantity(
  ctx: TransactionCtx,
  flowerId: number,
  now: Date,
  tableName = 'stock-reservations',
): Promise<number> {
  const adapter = getAdapterName(ctx)
  const payload = ctx.req.payload
  const nowISO = now.toISOString()

  if (adapter === 'postgres') {
    const sessionDb = getTransactionalSession(ctx)
    if (typeof sessionDb.execute !== 'function') {
      throw new Error('STOCK_BUSY_RETRY: sessão PG sem método execute')
    }

    const result = await sessionDb.execute(sql`
      SELECT COALESCE(SUM(quantity), 0) AS qty
      FROM ${sql.identifier(tableName)}
      WHERE flower_id = ${flowerId}
        AND status = 'active'
        AND expires_at > ${nowISO}
    `)
    return Number(result?.rows?.[0]?.qty ?? 0)
  }

  // SQLite: paginação completa dentro da transacção
  let total = 0
  let page = 1
  const limit = 100

  while (true) {
    const reservations = await payload.find({
      collection: tableName,
      where: {
        flower: { equals: flowerId },
        status: { equals: 'active' },
        expiresAt: { greater_than: nowISO },
      },
      page,
      limit,
      depth: 0,
      req: ctx.req,
    })

    for (const r of reservations.docs) {
      total += (r as any).quantity ?? 0
    }

    if (reservations.docs.length < limit) break
    page++
  }

  return total
}

/**
 * Verifica se um erro é SQLITE_BUSY (para decisão de retry).
 */
export function isSQLiteBusyError(err: unknown): boolean {
  const msg = (err as any)?.message || ''
  return msg.includes('SQLITE_BUSY') || msg.includes('database is locked')
}