import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1G — Payment Fields (SQLite)
 *
 * Adds fields needed for Stripe payment processing:
 * - payment_provider (text, default 'stripe')
 * - stripe_payment_intent_id (text, unique when present)
 * - payment_method_type (text, informational snapshot)
 * - paid_at (timestamp)
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
    WHERE name IN ('payment_provider', 'stripe_payment_intent_id');
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add new columns
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`payment_provider\` text DEFAULT 'stripe';`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`stripe_payment_intent_id\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`payment_method_type\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`paid_at\` text;`)

  // Add unique index on stripe_payment_intent_id
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_stripe_payment_intent_id_unique\` ON \`orders\` (\`stripe_payment_intent_id\`);`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name IN ('payment_provider', 'stripe_payment_intent_id');
  `)
  if (!colCheck?.cnt) {
    // Already clean
    return
  }

  // Drop index first
  await db.run(sql`DROP INDEX IF EXISTS \`orders_stripe_payment_intent_id_unique\`;`)

  // Drop columns
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`payment_provider\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`stripe_payment_intent_id\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`payment_method_type\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`paid_at\`;`)
}