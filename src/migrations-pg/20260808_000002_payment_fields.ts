import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1G — Payment Fields (PostgreSQL)
 *
 * Adds fields needed for Stripe payment processing:
 * - payment_provider (varchar, default 'stripe')
 * - stripe_payment_intent_id (varchar, unique when present)
 * - payment_method_type (varchar, informational snapshot)
 * - paid_at (timestamp)
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
    AND column_name IN ('payment_provider', 'stripe_payment_intent_id');
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Columns already exist on orders table. Migration already applied.')
  }

  // Add columns
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "payment_provider" varchar DEFAULT 'stripe';`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "stripe_payment_intent_id" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "payment_method_type" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "paid_at" timestamptz;`)

  // Add unique index on stripe_payment_intent_id
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_payment_intent_id_unique"
    ON "orders" USING btree ("stripe_payment_intent_id");
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
    AND column_name IN ('payment_provider', 'stripe_payment_intent_id');
  `)
  if (!colCheck?.rows?.[0]?.cnt) {
    return
  }

  // Drop index
  await db.execute(sql`DROP INDEX IF EXISTS "orders_stripe_payment_intent_id_unique";`)

  // Drop columns
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_provider";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "stripe_payment_intent_id";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_method_type";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paid_at";`)
}