import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Verify collections exists
  const catCheck = await db.execute(sql`SELECT to_regclass('public.collections') AS exists;`)
  if (!catCheck?.rows?.[0]?.exists) throw new Error('[UP] Table "collections" does not exist.')

  // 2. Verify collections.name exists
  const nameCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collections' AND column_name = 'name';
  `)
  if (!nameCheck?.rows?.length) throw new Error('[UP] Column "collections.name" does not exist.')

  // 3. Verify collections_locales does NOT exist
  const localesCheck = await db.execute(sql`SELECT to_regclass('public.collections_locales') AS exists;`)
  if (localesCheck?.rows?.[0]?.exists) throw new Error('[UP] Table "collections_locales" already exists.')

  // 4. Create collections_locales table
  await db.execute(sql`
    CREATE TABLE "collections_locales" (
      "name" varchar NOT NULL,
      "description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
  `)

  // 5. Add foreign key constraint
  await db.execute(sql`
    ALTER TABLE "collections_locales"
    ADD CONSTRAINT "collections_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id")
    REFERENCES "public"."collections"("id")
    ON DELETE cascade
    ON UPDATE no action;
  `)

  // 6. Unique index on (name, _locale) — renamed to avoid collision with collections_name_idx
  await db.execute(sql`
    CREATE UNIQUE INDEX "collections_locales_name_locale_unique"
    ON "collections_locales" USING btree ("name", "_locale");
  `)

  // 7. Unique index on (_locale, _parent_id)
  await db.execute(sql`
    CREATE UNIQUE INDEX "collections_locales_locale_parent_id_unique"
    ON "collections_locales" USING btree ("_locale", "_parent_id");
  `)

  // 8. Backfill PT
  await db.execute(sql`
    INSERT INTO "collections_locales" ("name", "description", "_locale", "_parent_id")
    SELECT "name", "description", 'pt'::text::"_locales", "id"
    FROM "collections"
    WHERE "name" IS NOT NULL AND "name" != '';
  `)

  // 9. Confirm backfill count
  const countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "collections_locales";`)
  const count = countResult?.rows?.[0]?.cnt ?? 0
  if (count < 1) throw new Error('[UP] Backfill inserted 0 rows.');

  // Drop old localized columns from base table
  await db.execute(sql`DROP INDEX IF EXISTS "collections_name_idx";`);
  await db.execute(sql`ALTER TABLE "collections" DROP COLUMN "name";`);
  await db.execute(sql`ALTER TABLE "collections" DROP COLUMN "description";`);
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Pre-check: ABORT if non-PT translations exist
  const nonPtResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "collections_locales" WHERE "_locale" != 'pt'::text::"_locales";
  `)
  const nonPtCount = nonPtResult?.rows?.[0]?.cnt ?? 0
  if (nonPtCount > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonPtCount} non-PT locale row(s) found in collections_locales. ` +
      `This DOWN would destroy those translations.`
    )
  }

  // 2. Restore PT name
  await db.execute(sql`
    UPDATE "collections"
    SET "name" = COALESCE(
      (SELECT "name" FROM "collections_locales"
       WHERE "collections_locales"."_parent_id" = "collections"."id"
       AND "collections_locales"."_locale" = 'pt'::text::"_locales"),
      "collections"."name"
    );
  `)

  // 3. Restore PT description
  await db.execute(sql`
    UPDATE "collections"
    SET "description" = COALESCE(
      (SELECT "description" FROM "collections_locales"
       WHERE "collections_locales"."_parent_id" = "collections"."id"
       AND "collections_locales"."_locale" = 'pt'::text::"_locales"),
      "collections"."description"
    );
  `)

  // 4. Drop indexes
  await db.execute(sql`DROP INDEX IF EXISTS "collections_locales_name_locale_unique";`)
  await db.execute(sql`DROP INDEX IF EXISTS "collections_locales_locale_parent_id_unique";`)

  // 5. Drop FK constraint
  await db.execute(sql`ALTER TABLE "collections_locales" DROP CONSTRAINT IF EXISTS "collections_locales_parent_id_fk";`)

  // 6. Drop the locales table
  await db.execute(sql`DROP TABLE IF EXISTS "collections_locales";`)
}