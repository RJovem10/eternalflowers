import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1A — Orders Model Expansion (PostgreSQL)
 *
 * UP:
 *   1. Creates orderStatus and paymentStatus enums.
 *   2. Validates orphan flower references in orders_items — rejects non-digit
 *      values and IDs that don't exist in flowers.
 *   3. Adds new columns to orders table.
 *   4. Backfills legacy orders with new fields.
 *   5. Rebuilds orders_items: flower text → flower_id FK.
 *   6. Adds indexes.
 *
 * DOWN:
 *   1. Validates that no non-legacy data would be destroyed (semantically
 *      equivalent check in SQLite and PostgreSQL).
 *   2. Reverts orders_items: flower_id → flower text.
 *   3. Drops added columns from orders.
 *   4. Drops enums.
 */

export async function up({ db }: MigrateArgs): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Create new enums
  // ──────────────────────────────────────────────────────────────────────────
  // PostgreSQL does NOT support CREATE TYPE IF NOT EXISTS.
  // Using bare CREATE TYPE intentionally — if the type already exists in an
  // unexpected state, the migration must fail (defensive design).
  await db.execute(sql`CREATE TYPE "public"."enum_orders_order_status" AS ENUM(
    'draft', 'pending_payment', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled', 'expired'
  );`)
  await db.execute(sql`CREATE TYPE "public"."enum_orders_payment_status" AS ENUM(
    'unpaid', 'pending', 'paid', 'failed', 'refunded'
  );`)

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Validate every non-empty orders_items.flower value
  // ──────────────────────────────────────────────────────────────────────────

  // Reject non-numeric values using POSIX regex: ^[0-9]+$
  const invalidFlowerVals = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "orders_items"
    WHERE "flower" IS NOT NULL
      AND "flower" != ''
      AND "flower" !~ '^[0-9]+$';
  `)
  const invalidCount = invalidFlowerVals?.rows?.[0]?.cnt ?? 0
  if (invalidCount > 0) {
    throw new Error(
      `[UP] ABORTED: ${invalidCount} orders_items.flower value(s) contain ` +
      'non-digit characters, whitespace, or are otherwise invalid. ' +
      'Only ASCII digits 0-9 are permitted for non-empty flower values. ' +
      'Run manual cleanup first.'
    )
  }

  // Validate that digit-only flower values resolve to an existing flowers.id.
  const orphans = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "orders_items" oi
    LEFT JOIN "flowers" f ON oi."flower"::integer = f."id"
    WHERE oi."flower" IS NOT NULL
      AND oi."flower" != ''
      AND f."id" IS NULL;
  `)
  const orphanCount = orphans?.rows?.[0]?.cnt ?? 0
  if (orphanCount > 0) {
    throw new Error(
      `[UP] ABORTED: ${orphanCount} orphan flower reference(s) found in orders_items. ` +
      'Every non-empty flower text must resolve to an existing flower id.'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: Add new columns to orders table
  // ──────────────────────────────────────────────────────────────────────────

  // Order number
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "order_number" varchar;`)

  // Customer group
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "customer_name" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "customer_email" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "customer_phone" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "customer_company_name" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "customer_tax_id" varchar;`)

  // Shipping address
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_recipient_name" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_phone" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_line1" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_line2" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_city" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_region" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_postal_code" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_address_country" varchar;`)

  // Billing
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_same_as_shipping" boolean DEFAULT true;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_recipient_name" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_phone" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_line1" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_line2" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_city" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_region" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_postal_code" varchar;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "billing_address_country" varchar;`)

  // Financial
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "shipping_cost" numeric;`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "currency" varchar DEFAULT 'EUR';`)

  // Status (use PG enums directly)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "order_status" "enum_orders_order_status" DEFAULT 'pending_payment';`)
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "payment_status" "enum_orders_payment_status" DEFAULT 'unpaid';`)

  // Checkout hash
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "checkout_request_hash" varchar;`)

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: Backfill legacy orders
  // ──────────────────────────────────────────────────────────────────────────
  await db.execute(sql`UPDATE "orders" SET "order_number" = 'LEGACY-' || "id" WHERE "order_number" IS NULL;`)
  await db.execute(sql`UPDATE "orders" SET "customer_email" = "email", "customer_name" = '' WHERE "customer_email" IS NULL;`)
  await db.execute(sql`UPDATE "orders" SET "currency" = 'EUR' WHERE "currency" IS NULL;`)

  // Legacy status → new statuses
  await db.execute(sql`UPDATE "orders" SET "order_status" = 'pending_payment', "payment_status" = 'unpaid' WHERE "status" = 'pending';`)
  await db.execute(sql`UPDATE "orders" SET "order_status" = 'confirmed', "payment_status" = 'paid' WHERE "status" = 'paid';`)
  await db.execute(sql`UPDATE "orders" SET "order_status" = 'cancelled', "payment_status" = 'unpaid' WHERE "status" = 'cancelled';`)

  // ──────────────────────────────────────────────────────────────────────────
  // Step 5: Rebuild orders_items — flower text → flower_id FK
  // ──────────────────────────────────────────────────────────────────────────

  // Add flower_id column
  await db.execute(sql`ALTER TABLE "orders_items" ADD COLUMN "flower_id" integer;`)
  await db.execute(sql`ALTER TABLE "orders_items" ADD COLUMN "line_total" numeric;`)
  await db.execute(sql`ALTER TABLE "orders_items" ADD COLUMN "production_mode" varchar;`)

  // Copy and transform data
  await db.execute(sql`
    UPDATE "orders_items" oi
    SET "flower_id" = oi."flower"::integer,
        "line_total" = oi."price" * oi."qty",
        "production_mode" = f."production_mode"
    FROM "flowers" f
    WHERE oi."flower"::integer = f."id";
  `)

  // Verify row count (all rows should have been updated)
  const nullFlowerCount = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "orders_items" WHERE "flower_id" IS NULL;`)
  if ((nullFlowerCount?.rows?.[0]?.cnt ?? 0) > 0) {
    throw new Error(
      `[UP] ${nullFlowerCount.rows[0].cnt} item(s) have a NULL flower_id after backfill. ` +
      'Migration aborted to prevent data loss.'
    )
  }

  // Drop old flower text column
  await db.execute(sql`ALTER TABLE "orders_items" DROP COLUMN "flower";`)

  // Add FK constraint on flower_id
  await db.execute(sql`ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_flower_fk" FOREIGN KEY ("flower_id") REFERENCES "public"."flowers"("id") ON DELETE set null ON UPDATE no action;`)

  // ──────────────────────────────────────────────────────────────────────────
  // Step 6: Add indexes
  // ──────────────────────────────────────────────────────────────────────────
  await db.execute(sql`CREATE UNIQUE INDEX "orders_order_number_unique" ON "orders" USING btree ("order_number");`)
  await db.execute(sql`CREATE UNIQUE INDEX "orders_checkout_request_hash_unique" ON "orders" USING btree ("checkout_request_hash");`)
  await db.execute(sql`CREATE INDEX "orders_customer_email_idx" ON "orders" USING btree ("customer_email");`)
  await db.execute(sql`CREATE INDEX "orders_order_status_idx" ON "orders" USING btree ("order_status");`)
  await db.execute(sql`CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");`)
  await db.execute(sql`CREATE INDEX "orders_items_flower_idx" ON "orders_items" USING btree ("flower_id");`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // ── Step 1: Validate — abort if any non-legacy data would be destroyed ──
  // Semantically equivalent check across SQLite and PostgreSQL.
  const nonLegacyOrders = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "orders"
    WHERE (
      "customer_name" IS NOT NULL AND "customer_name" != ''
    ) OR "customer_phone" IS NOT NULL
      OR "customer_company_name" IS NOT NULL
      OR "customer_tax_id" IS NOT NULL
      OR "shipping_address_line1" IS NOT NULL
      OR "shipping_cost" IS NOT NULL
      OR "checkout_request_hash" IS NOT NULL
      OR "total" IS NULL
      OR ("order_number" IS NOT NULL AND SUBSTRING("order_number" FROM 1 FOR 7) != 'LEGACY-');
  `)
  const nonLegacyCount = nonLegacyOrders?.rows?.[0]?.cnt ?? 0
  if (nonLegacyCount > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonLegacyCount} order(s) have non-legacy data. ` +
      'This DOWN would destroy data added by the new schema. Ensure backup is available before rolling back.'
    )
  }

  // Non-legacy items
  const nonLegacyItems = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "orders_items"
    WHERE "line_total" IS NOT NULL
      AND "line_total" != COALESCE("price", 0) * COALESCE("qty", 0);
  `)
  const nonLegacyItemCount = nonLegacyItems?.rows?.[0]?.cnt ?? 0
  if (nonLegacyItemCount > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonLegacyItemCount} item(s) have custom lineTotal. ` +
      'This DOWN would destroy data. Ensure backup is available before rolling back.'
    )
  }

  // ── Step 2: Revert orders_items — drop flower_id FK, add back flower text ──
  await db.execute(sql`ALTER TABLE "orders_items" DROP CONSTRAINT IF EXISTS "orders_items_flower_fk";`)
  await db.execute(sql`ALTER TABLE "orders_items" ADD COLUMN "flower" varchar;`)

  // Copy flower_id back to text
  await db.execute(sql`UPDATE "orders_items" SET "flower" = CAST("flower_id" AS TEXT);`)

  // Verify all rows have flower set
  const nullFlower = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "orders_items" WHERE "flower" IS NULL;`)
  if ((nullFlower?.rows?.[0]?.cnt ?? 0) > 0) {
    throw new Error(
      `[DOWN] ${nullFlower.rows[0].cnt} item(s) have NULL flower after backfill. Rollback aborted.`
    )
  }

  // Drop new columns from orders_items
  await db.execute(sql`ALTER TABLE "orders_items" DROP COLUMN "flower_id";`)
  await db.execute(sql`ALTER TABLE "orders_items" DROP COLUMN "line_total";`)
  await db.execute(sql`ALTER TABLE "orders_items" DROP COLUMN "production_mode";`)

  // ── Step 3: Drop added columns from orders ───────────────────────────────
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "order_number";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "customer_name";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "customer_email";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "customer_phone";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "customer_company_name";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "customer_tax_id";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_recipient_name";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_phone";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_line1";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_line2";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_city";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_region";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_postal_code";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_address_country";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_same_as_shipping";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_recipient_name";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_phone";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_line1";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_line2";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_city";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_region";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_postal_code";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "billing_address_country";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "shipping_cost";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "currency";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "order_status";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "payment_status";`)
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN "checkout_request_hash";`)

  // ── Step 4: Drop enums ───────────────────────────────────────────────────
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_orders_order_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_orders_payment_status";`)
}