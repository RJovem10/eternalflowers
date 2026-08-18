import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1S — Coupon Redemption (SQLite)
 *
 * UP:
 *   - Adds coupon_redeemed_at column to orders table
 *
 * DOWN:
 *   - Drops coupon_redeemed_at column from orders table
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify orders table exists
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='orders';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  // Verify column doesn't already exist
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name = 'coupon_redeemed_at';
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Column "coupon_redeemed_at" already exists on orders. Migration already applied.')
  }

  await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`coupon_redeemed_at\` text;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name = 'coupon_redeemed_at';
  `)
  if (!colCheck?.cnt) {
    return
  }

  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`coupon_redeemed_at\`;`)
}