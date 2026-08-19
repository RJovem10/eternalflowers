import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1Q — canShareShippingPackage on Flowers
 *
 * Adds can_share_shipping_package boolean column to flowers table
 * for identifying standard products that may share one shipping
 * package with other compatible standard products.
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
    WHERE name = 'can_share_shipping_package';
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Column can_share_shipping_package already exists. Migration already applied.')
  }

  // Add column with default false
  await db.run(sql`ALTER TABLE \`flowers\` ADD COLUMN \`can_share_shipping_package\` integer DEFAULT 0 NOT NULL;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('flowers')
    WHERE name = 'can_share_shipping_package';
  `)
  if (!colCheck?.cnt) {
    // Already clean
    return
  }

  // Check if any products have this set to true — warn but allow rollback
  const flaggedCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`flowers\` WHERE \`can_share_shipping_package\` = 1;
  `)
  if (flaggedCheck?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${flaggedCheck.cnt} product(s) have can_share_shipping_package=true. ` +
      `This DOWN would destroy that data. Ensure backup is available before rolling back.`
    )
  }

  await db.run(sql`ALTER TABLE \`flowers\` DROP COLUMN \`can_share_shipping_package\`;`)
}