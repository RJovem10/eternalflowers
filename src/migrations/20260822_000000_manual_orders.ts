import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

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

async function getOrderColumns(db: any): Promise<Set<string>> {
  const rows = await db.all(sql`PRAGMA table_info("orders");`)
  return new Set((rows || []).map((row: any) => String(row.name)))
}

/**
 * Manual Orders and manual-payment audit data (SQLite).
 *
 * `orders.email` deliberately remains NOT NULL for legacy compatibility.
 * Manual orders without an email use customer_email=NULL and legacy email=''.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  const ordersCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM sqlite_master
    WHERE type = 'table' AND name = 'orders';
  `)
  if (!Number(ordersCheck?.cnt)) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  const usersCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM sqlite_master
    WHERE type = 'table' AND name = 'users';
  `)
  if (!Number(usersCheck?.cnt)) {
    throw new Error('[UP] Table "users" does not exist.')
  }

  const existingColumns = await getOrderColumns(db)
  const conflicts = NEW_COLUMNS.filter((column) => existingColumns.has(column))
  if (conflicts.length > 0) {
    throw new Error(
      `[UP] Manual-order columns already exist on "orders": ${conflicts.join(', ')}. ` +
      'Refusing to apply a partial or duplicate migration.',
    )
  }

  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "order_source" text DEFAULT 'website' NOT NULL;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "sales_channel" text;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "internal_note" text;`)

  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "shipping_quote_reference" text;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "shipping_confirmed_at" text;`)
  await db.run(sql`
    ALTER TABLE "orders" ADD COLUMN "shipping_confirmed_by_id" integer
    REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "manual_payment_reference" text;`)
  await db.run(sql`
    ALTER TABLE "orders" ADD COLUMN "manual_payment_confirmed_by_id" integer
    REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "payment_link_token_hash" text;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "payment_link_issued_at" text;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "payment_link_expires_at" text;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "payment_link_consumed_at" text;`)
  await db.run(sql`
    ALTER TABLE "orders" ADD COLUMN "payment_link_issued_by_id" integer
    REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "manual_refund_reference" text;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "manual_refunded_at" text;`)
  await db.run(sql`
    ALTER TABLE "orders" ADD COLUMN "manual_refund_confirmed_by_id" integer
    REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
  `)

  // The NOT NULL default performs the backfill when the column is added.
  // Keep the explicit update as a defensive guarantee for imported schemas.
  await db.run(sql`UPDATE "orders" SET "order_source" = 'website' WHERE "order_source" IS NULL;`)

  await db.run(sql`CREATE INDEX IF NOT EXISTS "orders_order_source_idx" ON "orders" ("order_source");`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "orders_shipping_confirmed_by_idx" ON "orders" ("shipping_confirmed_by_id");`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "orders_manual_payment_confirmed_by_idx" ON "orders" ("manual_payment_confirmed_by_id");`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS "orders_payment_link_token_hash_idx" ON "orders" ("payment_link_token_hash");`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "orders_payment_link_issued_by_idx" ON "orders" ("payment_link_issued_by_id");`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "orders_manual_refund_confirmed_by_idx" ON "orders" ("manual_refund_confirmed_by_id");`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const ordersCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM sqlite_master
    WHERE type = 'table' AND name = 'orders';
  `)
  if (!Number(ordersCheck?.cnt)) return

  const existingColumns = await getOrderColumns(db)
  const present = NEW_COLUMNS.filter((column) => existingColumns.has(column))
  if (present.length === 0) return
  if (present.length !== NEW_COLUMNS.length) {
    const missing = NEW_COLUMNS.filter((column) => !existingColumns.has(column))
    throw new Error(
      `[DOWN] Partial manual-order schema detected. Missing columns: ${missing.join(', ')}. ` +
      'Refusing a destructive rollback.',
    )
  }

  const usageCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt
    FROM "orders"
    WHERE "order_source" IS NULL
       OR "order_source" <> 'website'
       OR "sales_channel" IS NOT NULL
       OR "internal_note" IS NOT NULL
       OR "shipping_quote_reference" IS NOT NULL
       OR "shipping_confirmed_at" IS NOT NULL
       OR "shipping_confirmed_by_id" IS NOT NULL
       OR "manual_payment_reference" IS NOT NULL
       OR "manual_payment_confirmed_by_id" IS NOT NULL
       OR "payment_link_token_hash" IS NOT NULL
       OR "payment_link_issued_at" IS NOT NULL
       OR "payment_link_expires_at" IS NOT NULL
       OR "payment_link_consumed_at" IS NOT NULL
       OR "payment_link_issued_by_id" IS NOT NULL
       OR "manual_refund_reference" IS NOT NULL
       OR "manual_refunded_at" IS NOT NULL
       OR "manual_refund_confirmed_by_id" IS NOT NULL;
  `)
  if (Number(usageCheck?.cnt) > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${Number(usageCheck.cnt)} order(s) contain manual-order, shipping, payment-link, ` +
      'manual-payment, or manual-refund data. Remove or migrate that data before rollback.',
    )
  }

  await db.run(sql`DROP INDEX IF EXISTS "orders_manual_refund_confirmed_by_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "orders_payment_link_issued_by_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "orders_payment_link_token_hash_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "orders_manual_payment_confirmed_by_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "orders_shipping_confirmed_by_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "orders_order_source_idx";`)

  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "manual_refund_confirmed_by_id";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "manual_refunded_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "manual_refund_reference";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "payment_link_issued_by_id";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "payment_link_consumed_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "payment_link_expires_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "payment_link_issued_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "payment_link_token_hash";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "manual_payment_confirmed_by_id";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "manual_payment_reference";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "shipping_confirmed_by_id";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "shipping_confirmed_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "shipping_quote_reference";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "internal_note";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "sales_channel";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "order_source";`)
}
