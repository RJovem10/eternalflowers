import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1Q — Add awaiting_shipping to order_status enum (PostgreSQL)
 *
 * UP:
 *   Adds 'awaiting_shipping' to the existing enum_orders_order_status
 *   using a safe DO block that handles duplicate_object gracefully
 *   (idempotent — safe to re-run).
 *
 * DOWN:
 *   Removes 'awaiting_shipping' from the enum by recreating it.
 *   Aborts if any order currently has orderStatus=awaiting_shipping
 *   to prevent data loss.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify enum exists
  const enumCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM pg_type
    WHERE typname = 'enum_orders_order_status';
  `)
  if (!enumCheck?.rows?.[0]?.cnt) {
    throw new Error('[UP] Enum enum_orders_order_status does not exist.')
  }

  // Verify awaiting_shipping is not already present
  const valueCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM pg_enum
    WHERE enumtypid = 'enum_orders_order_status'::regtype
    AND enumlabel = 'awaiting_shipping';
  `)
  if (valueCheck?.rows?.[0]?.cnt > 0) {
    // Already exists — idempotent
    return
  }

  // Add value to enum using safe DO block
  await db.execute(sql`
    DO $$
    BEGIN
      ALTER TYPE "public"."enum_orders_order_status" ADD VALUE 'awaiting_shipping';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // Check enum exists
  const enumCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM pg_type
    WHERE typname = 'enum_orders_order_status';
  `)
  if (!enumCheck?.rows?.[0]?.cnt) {
    return
  }

  // Check if any orders have awaiting_shipping status
  const usageCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "orders"
    WHERE "order_status" = 'awaiting_shipping';
  `)
  if (usageCheck?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${usageCheck.rows[0].cnt} order(s) have orderStatus=awaiting_shipping. ` +
      'Cannot remove enum value with active orders. Ensure no awaiting_shipping orders exist before rollback.'
    )
  }

  // Check awaiting_shipping is in the enum
  const valueCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM pg_enum
    WHERE enumtypid = 'enum_orders_order_status'::regtype
    AND enumlabel = 'awaiting_shipping';
  `)
  if (!valueCheck?.rows?.[0]?.cnt) {
    // Already clean
    return
  }

  // Recreate enum without awaiting_shipping
  // PG does not support DROP VALUE, so we recreate the type
  await db.execute(sql`ALTER TYPE "public"."enum_orders_order_status" RENAME TO "enum_orders_order_status_old";`)

  await db.execute(sql`
    CREATE TYPE "public"."enum_orders_order_status" AS ENUM(
      'draft', 'pending_payment', 'confirmed', 'processing',
      'shipped', 'completed', 'cancelled', 'expired'
    );
  `)

  // Update orders table to use new enum (cast via text)
  await db.execute(sql`
    ALTER TABLE "orders"
    ALTER COLUMN "order_status" TYPE "public"."enum_orders_order_status"
    USING "order_status"::text::"public"."enum_orders_order_status";
  `)

  // Drop old enum
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_orders_order_status_old";`)
}