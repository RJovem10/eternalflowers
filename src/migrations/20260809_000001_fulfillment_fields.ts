import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1N — Fulfillment Fields (SQLite)
 *
 * Adds fields needed for order fulfillment workflow:
 * - processing_at (timestamp, nullable)
 * - shipped_at (timestamp, nullable)
 * - completed_at (timestamp, nullable)
 * - tracking_number (text, nullable)
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify orders table exists
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='orders';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  // Verify columns don't already exist
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name IN ('processing_at', 'shipped_at', 'completed_at', 'tracking_number');
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add columns
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "processing_at" timestamptz;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamptz;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "completed_at" timestamptz;`)
  await db.run(sql`ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name IN ('processing_at', 'shipped_at', 'completed_at', 'tracking_number');
  `)
  if (colCheck?.cnt === 0) {
    // Nothing to remove
    return
  }

  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "tracking_number";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "completed_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "shipped_at";`)
  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "processing_at";`)
}