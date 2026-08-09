import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1N — Fulfillment Fields (PostgreSQL)
 *
 * Adds fields needed for order fulfillment workflow:
 * - processing_at (timestamp, nullable)
 * - shipped_at (timestamp, nullable)
 * - completed_at (timestamp, nullable)
 * - tracking_number (text, nullable)
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
    AND column_name IN ('processing_at', 'shipped_at', 'completed_at', 'tracking_number');
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add columns
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "processing_at" timestamptz;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamptz;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "completed_at" timestamptz;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
    AND column_name IN ('processing_at', 'shipped_at', 'completed_at', 'tracking_number');
  `)
  if (colCheck?.rows?.[0]?.cnt === 0) {
    return
  }

  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_number";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "completed_at";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipped_at";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "processing_at";`)
}