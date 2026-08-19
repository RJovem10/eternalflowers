import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1N — isPublic boolean field on Flowers (PostgreSQL)
 *
 * Adds is_public boolean column to flowers table for controlling
 * public storefront visibility vs internal/test products.
 *
 * UP: Adds column with default true (existing products remain public).
 * DOWN: Drops column; warns if any products have isPublic=false.
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
    AND column_name = 'is_public';
  `)
  if (colCheck?.rows?.[0]?.cnt > 0) {
    throw new Error('[UP] Column is_public already exists. Migration already applied.')
  }

  // Add column with default true NOT NULL
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'flowers'
    AND column_name = 'is_public';
  `)
  if (!colCheck?.rows?.[0]?.cnt) {
    // Already clean
    return
  }

  // Warn if any products have isPublic=false
  const privateCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "flowers" WHERE "is_public" = false;
  `)
  if (privateCheck?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${privateCheck.rows[0].cnt} product(s) have is_public=false. ` +
      `This DOWN would destroy the visibility distinction without restoring it. ` +
      `Ensure backup is available before rolling back.`
    )
  }

  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "is_public";`)
}