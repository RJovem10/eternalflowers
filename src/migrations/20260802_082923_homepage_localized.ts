import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  // -- PRECONDITIONS (no mutations) --
  const tableCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='homepage';`)
  if (!tableCheck?.cnt) throw new Error('[UP] Table "homepage" does not exist.')

  const localesCheck = await db.get(sql`SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='homepage_locales';`)
  if (localesCheck?.cnt > 0) throw new Error('[UP] Table "homepage_locales" already exists.')

  // -- MUTATIONS with DDL rollback compensation --
  // SQLite's DDL (CREATE TABLE, DROP TABLE) commits the current transaction,
  // so a failure after DDL cannot be rolled back by the runner's transaction.
  // This compensation cleans up partial state manually.

  let createdStructure = false
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS \`homepage_locales\` (
      \`hero_hero_title\` text NOT NULL,
      \`hero_hero_subtitle\` text NOT NULL,
      \`hero_primary_button_text\` text NOT NULL,
      \`hero_secondary_button_text\` text,
      \`real_flowers_title\` text NOT NULL,
      \`real_flowers_subtitle\` text,
      \`story_title\` text NOT NULL,
      \`story_text\` text NOT NULL,
      \`international_title\` text NOT NULL,
      \`international_subtitle\` text,
      \`instagram_title\` text NOT NULL,
      \`instagram_text\` text,
      \`cta_title\` text NOT NULL,
      \`cta_subtitle\` text,
      \`cta_button_text\` text NOT NULL,
      \`footer_brand_description\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      \`_locale\` text NOT NULL,
      \`_parent_id\` integer NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    createdStructure = true

    await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`homepage_locales_locale_parent_id_unique\` ON \`homepage_locales\` (\`_locale\`,\`_parent_id\`);`)

    await db.run(sql`INSERT INTO \`homepage_locales\` (
      \`hero_hero_title\`, \`hero_hero_subtitle\`, \`hero_primary_button_text\`, \`hero_secondary_button_text\`,
      \`real_flowers_title\`, \`real_flowers_subtitle\`,
      \`story_title\`, \`story_text\`,
      \`international_title\`, \`international_subtitle\`,
      \`instagram_title\`, \`instagram_text\`,
      \`cta_title\`, \`cta_subtitle\`, \`cta_button_text\`,
      \`footer_brand_description\`, \`_locale\`, \`_parent_id\`
    )
    SELECT
      \`hero_hero_title\`, \`hero_hero_subtitle\`, \`hero_primary_button_text\`, \`hero_secondary_button_text\`,
      \`real_flowers_title\`, \`real_flowers_subtitle\`,
      \`story_title\`, \`story_text\`,
      \`international_title\`, \`international_subtitle\`,
      \`instagram_title\`, \`instagram_text\`,
      \`cta_title\`, \`cta_subtitle\`, \`cta_button_text\`,
      \`footer_brand_description\`, 'pt', \`id\`
    FROM \`homepage\`
    WHERE \`hero_hero_title\` IS NOT NULL AND \`hero_hero_title\` != '';`)

    const countResult = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`homepage_locales\`;`)
    if (!countResult?.cnt || countResult.cnt < 1) {
      throw new Error('[UP] Backfill inserted 0 rows.')
    }
  } catch (err) {
    // Compensatory cleanup: if we created the table but something failed,
    // manually remove the E4 structure since SQLite DDL cannot be rolled back.
    if (createdStructure) {
      try {
        await db.run(sql`DROP INDEX IF EXISTS \`homepage_locales_locale_parent_id_unique\`;`)
      } catch { /* best-effort */ }
      try {
        await db.run(sql`DROP TABLE IF EXISTS \`homepage_locales\`;`)
      } catch { /* best-effort */ }
    }
    // Re-throw the original error with context
    const originalMsg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[UP] Migration failed and was cleaned up: ${originalMsg}`
    )
  }
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  const nonPtResult = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`homepage_locales\` WHERE \`_locale\` != 'pt';`)
  if (nonPtResult?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonPtResult.cnt} non-PT locale row(s) found in homepage_locales. ` +
      `This DOWN would destroy those translations.`
    )
  }

  await db.run(sql`UPDATE \`homepage\` SET
    \`hero_hero_title\` = COALESCE((SELECT \`hero_hero_title\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`hero_hero_title\`),
    \`hero_hero_subtitle\` = COALESCE((SELECT \`hero_hero_subtitle\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`hero_hero_subtitle\`),
    \`hero_primary_button_text\` = COALESCE((SELECT \`hero_primary_button_text\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`hero_primary_button_text\`),
    \`hero_secondary_button_text\` = COALESCE((SELECT \`hero_secondary_button_text\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`hero_secondary_button_text\`),
    \`real_flowers_title\` = COALESCE((SELECT \`real_flowers_title\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`real_flowers_title\`),
    \`real_flowers_subtitle\` = COALESCE((SELECT \`real_flowers_subtitle\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`real_flowers_subtitle\`),
    \`story_title\` = COALESCE((SELECT \`story_title\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`story_title\`),
    \`story_text\` = COALESCE((SELECT \`story_text\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`story_text\`),
    \`international_title\` = COALESCE((SELECT \`international_title\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`international_title\`),
    \`international_subtitle\` = COALESCE((SELECT \`international_subtitle\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`international_subtitle\`),
    \`instagram_title\` = COALESCE((SELECT \`instagram_title\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`instagram_title\`),
    \`instagram_text\` = COALESCE((SELECT \`instagram_text\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`instagram_text\`),
    \`cta_title\` = COALESCE((SELECT \`cta_title\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`cta_title\`),
    \`cta_subtitle\` = COALESCE((SELECT \`cta_subtitle\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`cta_subtitle\`),
    \`cta_button_text\` = COALESCE((SELECT \`cta_button_text\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`cta_button_text\`),
    \`footer_brand_description\` = COALESCE((SELECT \`footer_brand_description\` FROM \`homepage_locales\` WHERE \`homepage_locales\`.\`_parent_id\` = \`homepage\`.\`id\` AND \`homepage_locales\`.\`_locale\` = 'pt'), \`homepage\`.\`footer_brand_description\`)
  ;`)

  await db.run(sql`DROP INDEX IF EXISTS \`homepage_locales_locale_parent_id_unique\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`homepage_locales\`;`)
}