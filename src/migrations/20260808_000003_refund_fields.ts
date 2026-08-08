import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1I — Refund Fields (SQLite)
 *
 * Adds fields needed for late payment refund:
 * - stripe_refund_id (text, unique when present)
 * - refund_reason (text, internal reason snapshot)
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
    WHERE name IN ('stripe_refund_id', 'refund_reason');
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add new columns
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`stripe_refund_id\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`refund_reason\` text;`)

  // Add unique index on stripe_refund_id
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_stripe_refund_id_unique\` ON \`orders\` (\`stripe_refund_id\`);`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name IN ('stripe_refund_id', 'refund_reason');
  `)
  if (!colCheck?.cnt) {
    // Already clean
    return
  }

  // Drop index first
  await db.run(sql`DROP INDEX IF EXISTS \`orders_stripe_refund_id_unique\`;`)

  // Drop columns
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`stripe_refund_id\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`refund_reason\`;`)
}