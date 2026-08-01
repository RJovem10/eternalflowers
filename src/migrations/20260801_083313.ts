import { sql } from '@payloadcms/db-sqlite'

interface MigrateUpArgs {
  db: any
  payload: any
  req: any
}

interface MigrateDownArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`flowers_locales\` (
    \`story\` text,
    \`id\` integer PRIMARY KEY NOT NULL,
    \`_locale\` text NOT NULL,
    \`_parent_id\` integer NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`flowers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`flowers_locales_locale_parent_id_unique\` ON \`flowers_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`INSERT INTO \`flowers_locales\` (\`story\`, \`_locale\`, \`_parent_id\`)
    SELECT \`story\`, 'pt', \`id\`
    FROM \`flowers\`
    WHERE \`story\` IS NOT NULL AND \`story\` != '';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Pre-check: ABORT if non-PT translations exist — they would be lost
  const result = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`flowers_locales\` WHERE \`_locale\` != 'pt';`)
  if (result?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${result.cnt} non-PT locale row(s) found in flowers_locales. ` +
      `This DOWN would destroy those translations. ` +
      `Use the pre-migration backup for rollback, or write a preservation migration first.`
    )
  }

  // Restore PT stories with COALESCE to avoid NULL-ing good data
  await db.run(sql`UPDATE \`flowers\` SET \`story\` = COALESCE(
    (SELECT \`story\` FROM \`flowers_locales\`
     WHERE \`flowers_locales\`.\`_parent_id\` = \`flowers\`.\`id\`
     AND \`flowers_locales\`.\`_locale\` = 'pt'),
    \`flowers\`.\`story\`
  );`)

  await db.run(sql`DROP TABLE IF EXISTS \`flowers_locales\`;`)
}