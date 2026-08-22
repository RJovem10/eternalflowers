import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

const NEW_COLUMNS = [
  'order_source',
  'sales_channel',
  'internal_note',
  'shipping_quote_reference',
  'shipping_confirmed_at',
  'shipping_confirmed_by_id',
  'manual_payment_reference',
  'manual_payment_confirmed_by_id',
  'payment_link_token_hash',
  'payment_link_issued_at',
  'payment_link_expires_at',
  'payment_link_consumed_at',
  'payment_link_issued_by_id',
  'manual_refund_reference',
  'manual_refunded_at',
  'manual_refund_confirmed_by_id',
] as const

async function getOrderColumns(db: any): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders';
  `)
  return new Set((result?.rows || []).map((row: any) => String(row.column_name)))
}

/**
 * Manual Orders and manual-payment audit data (PostgreSQL).
 *
 * `orders.email` deliberately remains NOT NULL for legacy compatibility.
 * Manual orders without an email use customer_email=NULL and legacy email=''.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  const ordersCheck = await db.execute(sql`SELECT to_regclass('public.orders') AS exists;`)
  if (!ordersCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "orders" does not exist.')
  }

  const usersCheck = await db.execute(sql`SELECT to_regclass('public.users') AS exists;`)
  if (!usersCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "users" does not exist.')
  }

  const existingColumns = await getOrderColumns(db)
  const conflicts = NEW_COLUMNS.filter((column) => existingColumns.has(column))
  if (conflicts.length > 0) {
    throw new Error(
      `[UP] Manual-order columns already exist on "orders": ${conflicts.join(', ')}. ` +
      'Refusing to apply a partial or duplicate migration.',
    )
  }

  const enumCheck = await db.execute(sql`
    SELECT typname
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname IN ('enum_orders_order_source', 'enum_orders_sales_channel');
  `)
  if ((enumCheck?.rows?.length || 0) > 0) {
    const names = enumCheck.rows.map((row: any) => row.typname).join(', ')
    throw new Error(`[UP] Manual-order enum type(s) already exist: ${names}.`)
  }

  await db.execute(sql`CREATE TYPE "public"."enum_orders_order_source" AS ENUM('website', 'manual');`)
  await db.execute(sql`CREATE TYPE "public"."enum_orders_sales_channel" AS ENUM('phone', 'in_person', 'whatsapp', 'instagram', 'other');`)

  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN "order_source" "enum_orders_order_source" DEFAULT 'website' NOT NULL,
      ADD COLUMN "sales_channel" "enum_orders_sales_channel",
      ADD COLUMN "internal_note" varchar,
      ADD COLUMN "shipping_quote_reference" varchar,
      ADD COLUMN "shipping_confirmed_at" timestamptz,
      ADD COLUMN "shipping_confirmed_by_id" integer,
      ADD COLUMN "manual_payment_reference" varchar,
      ADD COLUMN "manual_payment_confirmed_by_id" integer,
      ADD COLUMN "payment_link_token_hash" varchar,
      ADD COLUMN "payment_link_issued_at" timestamptz,
      ADD COLUMN "payment_link_expires_at" timestamptz,
      ADD COLUMN "payment_link_consumed_at" timestamptz,
      ADD COLUMN "payment_link_issued_by_id" integer,
      ADD COLUMN "manual_refund_reference" varchar,
      ADD COLUMN "manual_refunded_at" timestamptz,
      ADD COLUMN "manual_refund_confirmed_by_id" integer;
  `)

  // The NOT NULL default performs the backfill when the column is added.
  // Keep the explicit update as a defensive guarantee for imported schemas.
  await db.execute(sql`UPDATE "orders" SET "order_source" = 'website' WHERE "order_source" IS NULL;`)

  await db.execute(sql`
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_shipping_confirmed_by_id_users_id_fk"
        FOREIGN KEY ("shipping_confirmed_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "orders_manual_payment_confirmed_by_id_users_id_fk"
        FOREIGN KEY ("manual_payment_confirmed_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "orders_payment_link_issued_by_id_users_id_fk"
        FOREIGN KEY ("payment_link_issued_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "orders_manual_refund_confirmed_by_id_users_id_fk"
        FOREIGN KEY ("manual_refund_confirmed_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
  `)

  await db.execute(sql`CREATE INDEX "orders_order_source_idx" ON "orders" USING btree ("order_source");`)
  await db.execute(sql`CREATE INDEX "orders_shipping_confirmed_by_idx" ON "orders" USING btree ("shipping_confirmed_by_id");`)
  await db.execute(sql`CREATE INDEX "orders_manual_payment_confirmed_by_idx" ON "orders" USING btree ("manual_payment_confirmed_by_id");`)
  await db.execute(sql`CREATE UNIQUE INDEX "orders_payment_link_token_hash_idx" ON "orders" USING btree ("payment_link_token_hash");`)
  await db.execute(sql`CREATE INDEX "orders_payment_link_issued_by_idx" ON "orders" USING btree ("payment_link_issued_by_id");`)
  await db.execute(sql`CREATE INDEX "orders_manual_refund_confirmed_by_idx" ON "orders" USING btree ("manual_refund_confirmed_by_id");`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const ordersCheck = await db.execute(sql`SELECT to_regclass('public.orders') AS exists;`)
  if (!ordersCheck?.rows?.[0]?.exists) return

  const existingColumns = await getOrderColumns(db)
  const present = NEW_COLUMNS.filter((column) => existingColumns.has(column))
  if (present.length === 0) return
  if (present.length !== NEW_COLUMNS.length) {
    const missing = NEW_COLUMNS.filter((column) => !existingColumns.has(column))
    throw new Error(
      `[DOWN] Partial manual-order schema detected. Missing columns: ${missing.join(', ')}. ` +
      'Refusing a destructive rollback.',
    )
  }

  const usageCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM "orders"
    WHERE "order_source" IS NULL
       OR "order_source" <> 'website'
       OR "sales_channel" IS NOT NULL
       OR "internal_note" IS NOT NULL
       OR "shipping_quote_reference" IS NOT NULL
       OR "shipping_confirmed_at" IS NOT NULL
       OR "shipping_confirmed_by_id" IS NOT NULL
       OR "manual_payment_reference" IS NOT NULL
       OR "manual_payment_confirmed_by_id" IS NOT NULL
       OR "payment_link_token_hash" IS NOT NULL
       OR "payment_link_issued_at" IS NOT NULL
       OR "payment_link_expires_at" IS NOT NULL
       OR "payment_link_consumed_at" IS NOT NULL
       OR "payment_link_issued_by_id" IS NOT NULL
       OR "manual_refund_reference" IS NOT NULL
       OR "manual_refunded_at" IS NOT NULL
       OR "manual_refund_confirmed_by_id" IS NOT NULL;
  `)
  const usageCount = Number(usageCheck?.rows?.[0]?.cnt || 0)
  if (usageCount > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${usageCount} order(s) contain manual-order, shipping, payment-link, ` +
      'manual-payment, or manual-refund data. Remove or migrate that data before rollback.',
    )
  }

  await db.execute(sql`DROP INDEX IF EXISTS "orders_manual_refund_confirmed_by_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "orders_payment_link_issued_by_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "orders_payment_link_token_hash_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "orders_manual_payment_confirmed_by_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "orders_shipping_confirmed_by_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "orders_order_source_idx";`)

  await db.execute(sql`
    ALTER TABLE "orders"
      DROP CONSTRAINT IF EXISTS "orders_manual_refund_confirmed_by_id_users_id_fk",
      DROP CONSTRAINT IF EXISTS "orders_payment_link_issued_by_id_users_id_fk",
      DROP CONSTRAINT IF EXISTS "orders_manual_payment_confirmed_by_id_users_id_fk",
      DROP CONSTRAINT IF EXISTS "orders_shipping_confirmed_by_id_users_id_fk";
  `)

  await db.execute(sql`
    ALTER TABLE "orders"
      DROP COLUMN "manual_refund_confirmed_by_id",
      DROP COLUMN "manual_refunded_at",
      DROP COLUMN "manual_refund_reference",
      DROP COLUMN "payment_link_issued_by_id",
      DROP COLUMN "payment_link_consumed_at",
      DROP COLUMN "payment_link_expires_at",
      DROP COLUMN "payment_link_issued_at",
      DROP COLUMN "payment_link_token_hash",
      DROP COLUMN "manual_payment_confirmed_by_id",
      DROP COLUMN "manual_payment_reference",
      DROP COLUMN "shipping_confirmed_by_id",
      DROP COLUMN "shipping_confirmed_at",
      DROP COLUMN "shipping_quote_reference",
      DROP COLUMN "internal_note",
      DROP COLUMN "sales_channel",
      DROP COLUMN "order_source";
  `)

  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_orders_sales_channel";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_orders_order_source";`)
}
