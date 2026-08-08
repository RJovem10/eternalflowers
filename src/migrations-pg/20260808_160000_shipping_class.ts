import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1K — Shipping Class on Flowers (PostgreSQL)
 *
 * Adds shipping_class column to flowers table for weight-based
 * shipping class selection (standard vs cupula).
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
    AND column_name = 'shipping_class';
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Column shipping_class already exists. Migration already applied.')
  }

  // Add column with default 'standard'
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "shipping_class" varchar DEFAULT 'standard' NOT NULL;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'flowers'
    AND column_name = 'shipping_class';
  `)
  if (!colCheck?.rows?.[0]?.cnt) {
    // Already clean
    return
  }

  // Products that are not 'standard' would lose data — abort
  const nonStandardCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "flowers" WHERE "shipping_class" IS NOT NULL AND "shipping_class" != 'standard';
  `)
  if (nonStandardCheck?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonStandardCheck.rows[0].cnt} product(s) have non-standard shipping_class. ` +
      `This DOWN would destroy that data. Ensure backup is available before rolling back.`
    )
  }

  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "shipping_class";`)
}