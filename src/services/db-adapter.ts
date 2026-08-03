/**
 * db-adapter.ts — Abstração de base de dados para stock e reservas
 *
 * Único ficheiro que acede directamente a payload.db.sessions[transactionID].
 * Isole diferenças entre PostgreSQL (FOR UPDATE, SUM SQL) e SQLite (run, paginação).
 *
 * NOTA: O slug Payload da colecção é 'stock-reservations' (com hífen).
 * A tabela na base de dados usa snake_case: 'stock_reservations'.
 * As queries SQL directas (PG) usam stock_reservations.
 * A Local API (SQLite/Payload) usa o slug 'stock-reservations'.
 */
import { sql } from 'drizzle-orm'
import type { TransactionCtx } from './transact'

export type AdapterName = 'postgres' | 'sqlite'

/** Nome da tabela SQL (snake_case) para PostgreSQL */
const PG_TABLE = 'stock_reservations'

/** Slug da colecção Payload (com hífen) para SQLite/Local API */
const COLLECTION_SLUG = 'stock-reservations'

function getAdapterName(ctx: TransactionCtx): AdapterName {
  const db = ctx.req.payload.db as any
  return db.name === 'postgres' ? 'postgres' : 'sqlite'
}

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
  if (getAdapterName(ctx) === 'postgres') {
    const sessionDb = getTransactionalSession(ctx)
    if (typeof sessionDb.execute !== 'function') {
      throw new Error('STOCK_BUSY_RETRY: sessão PG sem método execute')
    }
    await sessionDb.execute(sql`SELECT id FROM flowers WHERE id = ${flowerId} FOR UPDATE`)
  }
}

/**
 * Soma a quantidade reservada activa para uma flower.
 * Executa dentro da transacção, após lock da flower.
 *
 * PostgreSQL: SUM SQL directo na sessão, usando PG_TABLE (snake_case).
 * SQLite: paginação completa via Payload Local API com COLLECTION_SLUG.
 *
 * Ambas as queries usam overrideAccess: true porque o serviço interno
 * precisa de ler reservas independentemente do access control do Payload.
 */
export async function sumActiveReservedQuantity(
  ctx: TransactionCtx,
  flowerId: number,
  now: Date,
): Promise<number> {
  const adapter = getAdapterName(ctx)
  const payload = ctx.req.payload
  const nowISO = now.toISOString()

  if (adapter === 'postgres') {
    const sessionDb = getTransactionalSession(ctx)
    if (typeof sessionDb.execute !== 'function') {
      throw new Error('STOCK_BUSY_RETRY: sessão PG sem método execute')
    }

    // Query SQL directa — usa PG_TABLE (snake_case), não o slug Payload
    const result = await sessionDb.execute(sql`
      SELECT COALESCE(SUM(quantity), 0) AS qty
      FROM ${sql.identifier(PG_TABLE)}
      WHERE flower_id = ${flowerId}
        AND status = 'active'
        AND expires_at > ${nowISO}
    `)
    return Number(result?.rows?.[0]?.qty ?? 0)
  }

  // SQLite: paginação completa via Payload Local API
  // Usa COLLECTION_SLUG (slug Payload) com overrideAccess: true
  // para contornar o access.read = () => false da colecção
  let total = 0
  let page = 1
  const limit = 100

  while (true) {
    const reservations = await payload.find({
      collection: COLLECTION_SLUG,
      where: {
        flower: { equals: flowerId },
        status: { equals: 'active' },
        expiresAt: { greater_than: nowISO },
      },
      page,
      limit,
      depth: 0,
      req: ctx.req,
      overrideAccess: true,
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

/**
 * Atualiza o stock e disponibilidade de uma flower dentro da transação.
 * PostgreSQL: UPDATE via SQL directo na sessão (contorna bug de Payload em localized collections).
 * SQLite: usa payload.update (funciona).
 */
export async function updateFlowerStock(
  ctx: TransactionCtx,
  flowerId: number,
  data: { stockQuantity?: number; availability?: string },
): Promise<void> {
  const adapter = getAdapterName(ctx)
  const payload = ctx.req.payload

  if (adapter === 'postgres') {
    const sessionDb = getTransactionalSession(ctx)
    if (data.stockQuantity !== undefined && data.availability) {
      await sessionDb.execute(sql`
        UPDATE flowers SET stock_quantity = ${data.stockQuantity}, availability = ${data.availability} WHERE id = ${flowerId}
      `)
    } else if (data.stockQuantity !== undefined) {
      await sessionDb.execute(sql`
        UPDATE flowers SET stock_quantity = ${data.stockQuantity} WHERE id = ${flowerId}
      `)
    } else if (data.availability) {
      await sessionDb.execute(sql`
        UPDATE flowers SET availability = ${data.availability} WHERE id = ${flowerId}
      `)
    }
  } else {
    await payload.update({
      collection: 'flowers',
      id: flowerId,
      data,
      req: ctx.req,
      overrideAccess: true,
    })
  }
}