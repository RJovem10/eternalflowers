import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1N — isPublic boolean field on Flowers
 *
 * Adds is_public boolean column to flowers table for controlling
 * public storefront visibility vs internal/test products.
 *
 * UP: Adds column with default true (existing products remain public).
 * DOWN: Drops column; warns if any products have isPublic=false.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify flowers table exists
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='flowers';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "flowers" does not exist.')
  }

  // Verify column doesn't already exist
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('flowers')
    WHERE name = 'is_public';
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Column is_public already exists. Migration already applied.')
  }

  // Add column with default true (1) NOT NULL
  await db.run(sql`ALTER TABLE \`flowers\` ADD COLUMN \`is_public\` integer DEFAULT 1 NOT NULL;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('flowers')
    WHERE name = 'is_public';
  `)
  if (!colCheck?.cnt) {
    // Already clean
    return
  }

  // Warn if any products have isPublic=false
  const privateCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`flowers\` WHERE \`is_public\` = 0;
  `)
  if (privateCheck?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${privateCheck.cnt} product(s) have is_public=false. ` +
      `This DOWN would destroy the visibility distinction without restoring it. ` +
      `Ensure backup is available before rolling back.`
    )
  }

  await db.run(sql`ALTER TABLE \`flowers\` DROP COLUMN \`is_public\`;`)
}