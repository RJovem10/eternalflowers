import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import {
  down as sqliteDown,
  up as sqliteUp,
} from './20260822_000000_manual_orders'
import {
  down as postgresDown,
  up as postgresUp,
} from '../migrations-pg/20260822_000000_manual_orders'

const NEW_COLUMNS = [
  'order_source',
  'sales_channel',
  'internal_note',
  'shipping_quote_reference',
  'shipping_confirmed_at',
  'shipping_confirmed_by_id',
  'manual_payment_reference',
  'manual_payment_confirmed_by_id',
  'payment_link_token_hash',
  'payment_link_issued_at',
  'payment_link_expires_at',
  'payment_link_consumed_at',
  'payment_link_issued_by_id',
  'manual_refund_reference',
  'manual_refunded_at',
  'manual_refund_confirmed_by_id',
] as const

function orderColumns(raw: Database.Database): Array<{ name: string; notnull: number }> {
  return raw.prepare('PRAGMA table_info("orders")').all() as Array<{ name: string; notnull: number }>
}

describe('20260822 manual-order migrations', () => {
  it('R/SQLite: migrates legacy rows, permits no-email manual data, enforces token uniqueness, and rolls back safely', async () => {
    const raw = new Database(':memory:')
    try {
      raw.pragma('foreign_keys = ON')
      raw.exec(`
        CREATE TABLE "users" (
          "id" integer PRIMARY KEY NOT NULL
        );
        CREATE TABLE "orders" (
          "id" integer PRIMARY KEY NOT NULL,
          "email" text NOT NULL,
          "customer_email" text
        );
        INSERT INTO "users" ("id") VALUES (9);
        INSERT INTO "orders" ("id", "email", "customer_email")
        VALUES (1, 'legacy@example.com', 'legacy@example.com');
      `)
      const db = drizzle(raw)

      await sqliteUp({ db, payload: {}, req: {} })

      const columnsAfterUp = orderColumns(raw)
      expect(columnsAfterUp.map(({ name }) => name)).toEqual(expect.arrayContaining([...NEW_COLUMNS]))
      expect(columnsAfterUp.find(({ name }) => name === 'email')?.notnull).toBe(1)
      expect(raw.prepare('SELECT order_source FROM orders WHERE id = 1').get())
        .toEqual({ order_source: 'website' })

      raw.prepare(`
        INSERT INTO orders (
          id, email, customer_email, order_source, sales_channel,
          manual_payment_reference, manual_payment_confirmed_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(2, '', null, 'manual', 'whatsapp', 'MBW-123', 9)
      expect(raw.prepare('SELECT email, customer_email, order_source, sales_channel FROM orders WHERE id = 2').get())
        .toEqual({ email: '', customer_email: null, order_source: 'manual', sales_channel: 'whatsapp' })

      raw.prepare('INSERT INTO orders (id, email, payment_link_token_hash) VALUES (?, ?, ?)')
        .run(3, '', 'same-sha256-hash')
      expect(() => raw.prepare(
        'INSERT INTO orders (id, email, payment_link_token_hash) VALUES (?, ?, ?)',
      ).run(4, '', 'same-sha256-hash')).toThrow(/UNIQUE constraint failed/i)

      await expect(sqliteDown({ db, payload: {}, req: {} }))
        .rejects.toThrow(/ABORTED.*contain manual-order/i)
      expect(orderColumns(raw).map(({ name }) => name)).toContain('order_source')

      raw.exec('DELETE FROM orders WHERE id <> 1;')
      await sqliteDown({ db, payload: {}, req: {} })

      expect(orderColumns(raw).map(({ name }) => name)).toEqual(['id', 'email', 'customer_email'])
      expect(raw.prepare('SELECT * FROM orders WHERE id = 1').get()).toEqual({
        id: 1,
        email: 'legacy@example.com',
        customer_email: 'legacy@example.com',
      })
      const manualIndexes = raw.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name LIKE 'orders_%manual%'
      `).all()
      expect(manualIndexes).toEqual([])
    } finally {
      raw.close()
    }
  })

  it('R/PostgreSQL: renders complete up/down DDL including enums, backfill, FKs, unique token hash and safe cleanup', async () => {
    const dialect = new PgDialect()
    const upStatements: string[] = []
    const upDB = {
      execute: vi.fn(async (query: any) => {
        const statement = dialect.sqlToQuery(query).sql
        upStatements.push(statement)
        if (statement.includes("to_regclass('public.orders')")) return { rows: [{ exists: 'orders' }] }
        if (statement.includes("to_regclass('public.users')")) return { rows: [{ exists: 'users' }] }
        if (statement.includes('information_schema.columns')) return { rows: [] }
        if (statement.includes('FROM pg_type')) return { rows: [] }
        return { rows: [] }
      }),
    }

    await postgresUp({ db: upDB, payload: {}, req: {} })
    const upSQL = upStatements.join('\n').replace(/\s+/g, ' ')
    expect(upSQL).toContain('enum_orders_order_source')
    expect(upSQL).toContain('enum_orders_sales_channel')
    expect(upSQL).toMatch(/ADD COLUMN "order_source" .* DEFAULT 'website' NOT NULL/)
    expect(upSQL).toContain(`UPDATE "orders" SET "order_source" = 'website' WHERE "order_source" IS NULL`)
    expect(upSQL).toContain('orders_manual_payment_confirmed_by_id_users_id_fk')
    expect(upSQL).toContain('orders_payment_link_issued_by_id_users_id_fk')
    expect(upSQL).toContain('CREATE UNIQUE INDEX "orders_payment_link_token_hash_idx"')
    expect(upSQL).not.toMatch(/ALTER (?:TABLE )?"?orders"?.*email.*DROP NOT NULL/i)

    const downStatements: string[] = []
    const downDB = {
      execute: vi.fn(async (query: any) => {
        const statement = dialect.sqlToQuery(query).sql
        downStatements.push(statement)
        if (statement.includes("to_regclass('public.orders')")) return { rows: [{ exists: 'orders' }] }
        if (statement.includes('information_schema.columns')) {
          return { rows: NEW_COLUMNS.map((column_name) => ({ column_name })) }
        }
        if (statement.includes('COUNT(*)::int')) return { rows: [{ cnt: 0 }] }
        return { rows: [] }
      }),
    }

    await postgresDown({ db: downDB, payload: {}, req: {} })
    const downSQL = downStatements.join('\n').replace(/\s+/g, ' ')
    expect(downSQL).toContain('DROP INDEX IF EXISTS "orders_payment_link_token_hash_idx"')
    expect(downSQL).toContain('DROP CONSTRAINT IF EXISTS "orders_manual_payment_confirmed_by_id_users_id_fk"')
    expect(downSQL).toContain('DROP COLUMN "order_source"')
    expect(downSQL).toContain('DROP TYPE IF EXISTS "public"."enum_orders_sales_channel"')
    expect(downSQL).toContain('DROP TYPE IF EXISTS "public"."enum_orders_order_source"')
  })
})
