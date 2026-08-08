import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1F — Checkout Finalization Fields
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
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='orders';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  // Verify columns don't already exist
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name IN ('checkout_attempt_id', 'shipping_provider');
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add new columns
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`checkout_attempt_id\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_provider\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_service_code\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_service_name\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_estimated_min_days\` numeric;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`shipping_estimated_max_days\` numeric;`)

  // Add unique index on checkout_attempt_id
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_checkout_attempt_id_unique\` ON \`orders\` (\`checkout_attempt_id\`);`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name IN ('checkout_attempt_id', 'shipping_provider');
  `)
  if (!colCheck?.cnt) {
    // Already clean — nothing to do
    return
  }

  // Drop index first
  await db.run(sql`DROP INDEX IF EXISTS \`orders_checkout_attempt_id_unique\`;`)

  // Drop columns
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`checkout_attempt_id\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_provider\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_service_code\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_service_name\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_estimated_min_days\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_estimated_max_days\`;`)
}