import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1Q — canShareShippingPackage on Flowers (PostgreSQL)
 *
 * Adds can_share_shipping_package boolean column to flowers table
 * for identifying standard products that may share one shipping
 * package with other compatible standard products.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify flowers table exists
  const tableCheck = await db.execute(sql`SELECT to_regclass('public.flowers') AS exists;`)
  if (!tableCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "flowers" does not exist.')
  }

  // Verify column doesn't already exist
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'flowers'
    AND column_name = 'can_share_shipping_package';
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Column can_share_shipping_package already exists. Migration already applied.')
  }

  // Add column with default false (boolean via integer 0/1)
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "can_share_shipping_package" boolean DEFAULT false NOT NULL;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'flowers'
    AND column_name = 'can_share_shipping_package';
  `)
  if (!colCheck?.rows?.[0]?.cnt) {
    // Already clean
    return
  }

  // Check if any products have this set to true — warn but allow rollback
  const flaggedCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "flowers" WHERE "can_share_shipping_package" = true;
  `)
  if (flaggedCheck?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${flaggedCheck.rows[0].cnt} product(s) have can_share_shipping_package=true. ` +
      `This DOWN would destroy that data. Ensure backup is available before rolling back.`
    )
  }

  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "can_share_shipping_package";`)
}