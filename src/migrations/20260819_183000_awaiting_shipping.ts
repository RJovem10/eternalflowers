import { sql } from '@payloadcms/db-sqlite'

// eslint-disable-next-line @typescript-eslint/no-unused-vars

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1Q — awaiting_shipping support (SQLite)
 *
 * SQLite uses TEXT for order_status, so no DDL change is needed.
 * This migration exists for parity with the PostgreSQL migration index.
 *
 * UP: Validates that the orders table exists (safety check).
 * DOWN: No-op — SQLite has no enum to roll back.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify orders table exists
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='orders';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "orders" does not exist.')
  }
  // SQLite: order_status is TEXT — no schema change needed
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // No-op: SQLite has no enum to revert
}