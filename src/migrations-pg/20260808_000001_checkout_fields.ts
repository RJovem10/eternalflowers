import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1F — Checkout Finalization Fields (PostgreSQL)
 *
 * Adds fields needed for checkout finalization:
 * - checkout_attempt_id (UUID, unique, server-generated)
 * - shipping_provider
 * - shipping_service_code
 * - shipping_service_name
 * - shipping_estimated_min_days
 * - shipping_estimated_max_days
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
    AND column_name IN ('checkout_attempt_id', 'shipping_provider');
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add columns
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "checkout_attempt_id" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_provider" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_service_code" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_service_name" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_estimated_min_days" numeric;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_estimated_max_days" numeric;`)

  // Add unique index on checkout_attempt_id
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "orders_checkout_attempt_id_unique"
    ON "orders" USING btree ("checkout_attempt_id");
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // Drop index
  await db.execute(sql`DROP INDEX IF EXISTS "orders_checkout_attempt_id_unique";`)

  // Drop columns
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "checkout_attempt_id";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_provider";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_service_code";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_service_name";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_estimated_min_days";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipping_estimated_max_days";`)
}