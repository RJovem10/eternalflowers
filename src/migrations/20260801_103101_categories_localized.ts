import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Verify categories exists
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='categories';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "categories" does not exist. Run E1 baseline migration first.')
  }

  // 2. Verify categories_locales does NOT exist
  const localesCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='categories_locales';`)
  if (localesCheck?.cnt > 0) {
    throw new Error('[UP] Table "categories_locales" already exists. Migration already applied or schema is in an unexpected state.')
  }

  // 3. Create categories_locales matching Payload-generated schema
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`categories_locales\` (
    \`name\` text NOT NULL,
    \`description\` text,
    \`id\` integer PRIMARY KEY NOT NULL,
    \`_locale\` text NOT NULL,
    \`_parent_id\` integer NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)

  // 4. Create unique index on (name, _locale) matching Payload convention
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`categories_locales_name_locale_unique\` ON \`categories_locales\` (\`name\`,\`_locale\`);`)

  // 5. Backfill PT — copy name and description from categories
  const insertResult = await db.run(sql`INSERT INTO \`categories_locales\` (\`name\`, \`description\`, \`_locale\`, \`_parent_id\`)
    SELECT \`name\`, \`description\`, 'pt', \`id\`
    FROM \`categories\`
    WHERE \`name\` IS NOT NULL AND \`name\` != '';`)

  // 6. Confirm backfill
  const countResult = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`categories_locales\`;`)
  if (!countResult?.cnt || countResult.cnt < 1) {
    throw new Error(`[UP] Backfill inserted 0 rows — no categories found.`)
  }
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Pre-check: ABORT if any non-PT translations exist
  const nonPtResult = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`categories_locales\` WHERE \`_locale\` != 'pt';`)
  if (nonPtResult?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonPtResult.cnt} non-PT locale row(s) found in categories_locales. ` +
      `This DOWN would destroy those translations. ` +
      `Use the pre-migration backup for rollback, or write a preservation migration first.`
    )
  }

  // 2. Restore PT name and description to categories (COALESCE-safe)
  await db.run(sql`UPDATE \`categories\` SET
    \`name\` = COALESCE(
      (SELECT \`name\` FROM \`categories_locales\`
       WHERE \`categories_locales\`.\`_parent_id\` = \`categories\`.\`id\`
       AND \`categories_locales\`.\`_locale\` = 'pt'),
      \`categories\`.\`name\`
    ),
    \`description\` = COALESCE(
      (SELECT \`description\` FROM \`categories_locales\`
       WHERE \`categories_locales\`.\`_parent_id\` = \`categories\`.\`id\`
       AND \`categories_locales\`.\`_locale\` = 'pt'),
      \`categories\`.\`description\`
    );`)

  // 3. Drop the unique index
  await db.run(sql`DROP INDEX IF EXISTS \`categories_locales_name_locale_unique\`;`)

  // 4. Drop the locales table
  await db.run(sql`DROP TABLE IF EXISTS \`categories_locales\`;`)
}