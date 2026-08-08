import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1I — Refund Fields (PostgreSQL)
 *
 * Adds fields needed for late payment refund:
 * - stripe_refund_id (varchar, unique when present)
 * - refund_reason (varchar, internal reason snapshot)
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify orders table exists
  const tableCheck = await db.execute(sql`SELECT to_regclass('public.orders') AS exists;`)
  if (!tableCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  // Verify columns don't already exist
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
    AND column_name IN ('stripe_refund_id', 'refund_reason');
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add columns
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "stripe_refund_id" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "refund_reason" varchar;`)

  // Add unique index on stripe_refund_id
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_refund_id_unique"
    ON "orders" USING btree ("stripe_refund_id");
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
    AND column_name IN ('stripe_refund_id', 'refund_reason');
  `)
  if (!colCheck?.rows?.[0]?.cnt) {
    return
  }

  // Drop index
  await db.execute(sql`DROP INDEX IF EXISTS "orders_stripe_refund_id_unique";`)

  // Drop columns
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_refund_id";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "refund_reason";`)
}