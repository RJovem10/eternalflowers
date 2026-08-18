import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1S — Coupon Redemption (PostgreSQL)
 *
 * UP:
 *   - Adds coupon_redeemed_at column to orders table
 *
 * DOWN:
 *   - Drops coupon_redeemed_at column from orders table
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify orders table exists
  const tableCheck = await db.execute(sql`SELECT to_regclass('public.orders') AS exists;`)
  if (!tableCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  // Verify column doesn't already exist
  const colCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'coupon_redeemed_at';
  `)
  if (colCheck?.rows?.length > 0) {
    throw new Error('[UP] Column "coupon_redeemed_at" already exists on "orders". Migration already applied.')
  }

  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "coupon_redeemed_at" timestamptz;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "coupon_redeemed_at";`)
}