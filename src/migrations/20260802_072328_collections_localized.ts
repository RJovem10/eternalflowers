import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Verify collections exists
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='collections';`)
  if (!tableCheck?.cnt) {
    throw new Error('[UP] Table "collections" does not exist.')
  }

  // 2. Verify collections_locales does NOT exist
  const localesCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='collections_locales';`)
  if (localesCheck?.cnt > 0) {
    throw new Error('[UP] Table "collections_locales" already exists.')
  }

  // 3. Create collections_locales matching Payload-generated schema
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`collections_locales\` (
    \`name\` text NOT NULL,
    \`description\` text,
    \`id\` integer PRIMARY KEY NOT NULL,
    \`_locale\` text NOT NULL,
    \`_parent_id\` integer NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`collections\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)

  // 4. Create unique index on (name, _locale) — renamed to avoid collision with existing collections_name_idx
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`collections_locales_name_locale_unique\` ON \`collections_locales\` (\`name\`,\`_locale\`);`)

  // 5. Create unique index on (_locale, _parent_id)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`collections_locales_locale_parent_id_unique\` ON \`collections_locales\` (\`_locale\`,\`_parent_id\`);`)

  // 6. Backfill PT
  await db.run(sql`INSERT INTO \`collections_locales\` (\`name\`, \`description\`, \`_locale\`, \`_parent_id\`)
    SELECT \`name\`, \`description\`, 'pt', \`id\`
    FROM \`collections\`
    WHERE \`name\` IS NOT NULL AND \`name\` != '';`)

  // 7. Confirm backfill
  const countResult = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`collections_locales\`;`)
  if (!countResult?.cnt || countResult.cnt < 1) {
    throw new Error('[UP] Backfill inserted 0 rows.')
  }
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Pre-check: ABORT if any non-PT translations exist
  const nonPtResult = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`collections_locales\` WHERE \`_locale\` != 'pt';`)
  if (nonPtResult?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonPtResult.cnt} non-PT locale row(s) found in collections_locales. ` +
      `This DOWN would destroy those translations. ` +
      `Use the pre-migration backup for rollback, or write a preservation migration first.`
    )
  }

  // 2. Restore PT name
  await db.run(sql`UPDATE \`collections\` SET \`name\` = COALESCE(
    (SELECT \`name\` FROM \`collections_locales\`
     WHERE \`collections_locales\`.\`_parent_id\` = \`collections\`.\`id\`
     AND \`collections_locales\`.\`_locale\` = 'pt'),
    \`collections\`.\`name\`
  );`)

  // 3. Restore PT description
  await db.run(sql`UPDATE \`collections\` SET \`description\` = COALESCE(
    (SELECT \`description\` FROM \`collections_locales\`
     WHERE \`collections_locales\`.\`_parent_id\` = \`collections\`.\`id\`
     AND \`collections_locales\`.\`_locale\` = 'pt'),
    \`collections\`.\`description\`
  );`)

  // 4. Drop indexes
  await db.run(sql`DROP INDEX IF EXISTS \`collections_locales_name_locale_unique\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`collections_locales_locale_parent_id_unique\`;`)

  // 5. Drop the locales table
  await db.run(sql`DROP TABLE IF EXISTS \`collections_locales\`;`)
}