import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Verify categories table exists
  const catCheck = await db.execute(sql`SELECT to_regclass('public.categories') AS exists;`)
  if (!catCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "categories" does not exist.')
  }

  // 2. Verify categories.name and categories.description exist
  const nameCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'name';
  `)
  if (!nameCheck?.rows?.length) {
    throw new Error('[UP] Column "categories.name" does not exist.')
  }

  // 3. Verify categories_locales does NOT already exist
  const localesCheck = await db.execute(sql`SELECT to_regclass('public.categories_locales') AS exists;`)
  if (localesCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "categories_locales" already exists.')
  }

  // 4. Create categories_locales table
  await db.execute(sql`
    CREATE TABLE "categories_locales" (
      "name" varchar NOT NULL,
      "description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
  `)

  // 5. Add foreign key constraint
  await db.execute(sql`
    ALTER TABLE "categories_locales"
    ADD CONSTRAINT "categories_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id")
    REFERENCES "public"."categories"("id")
    ON DELETE cascade
    ON UPDATE no action;
  `)

  // 6. Create unique index on (name, _locale) — business unique
  await db.execute(sql`
    CREATE UNIQUE INDEX "categories_locales_name_locale_unique"
    ON "categories_locales" USING btree ("name", "_locale");
  `)

  // 7. Create unique index on (_locale, _parent_id) — prevents duplicate locale entries
  await db.execute(sql`
    CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique"
    ON "categories_locales" USING btree ("_locale", "_parent_id");
  `)

  // 8. Backfill PT — copy name and description
  await db.execute(sql`
    INSERT INTO "categories_locales" ("name", "description", "_locale", "_parent_id")
    SELECT "name", "description", 'pt'::text::"_locales", "id"
    FROM "categories"
    WHERE "name" IS NOT NULL AND "name" != '';
  `)

  // 9. Confirm backfill count
  const countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "categories_locales";`)
  const count = countResult?.rows?.[0]?.cnt ?? 0
  if (count < 1) {
    throw new Error('[UP] Backfill inserted 0 rows.')
  }

  // Drop old localized columns from base table
  await db.execute(sql`DROP INDEX IF EXISTS "categories_name_idx";`);
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN "name";`);
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN "description";`);
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Pre-check: ABORT if any non-PT translations exist
  const nonPtResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "categories_locales" WHERE "_locale" != 'pt'::text::"_locales";
  `)
  const nonPtCount = nonPtResult?.rows?.[0]?.cnt ?? 0
  if (nonPtCount > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonPtCount} non-PT locale row(s) found in categories_locales. ` +
      `This DOWN would destroy those translations. ` +
      `Use the pre-migration backup for rollback, or write a preservation migration first.`
    )
  }

  // 2. Recreate the dropped columns before restoring data
  await db.execute(sql`ALTER TABLE "categories" ADD COLUMN "name" varchar;`);
  await db.execute(sql`ALTER TABLE "categories" ADD COLUMN "description" varchar;`);

  // 3. Restore PT name
  await db.execute(sql`
    UPDATE "categories"
    SET "name" = COALESCE(
      (SELECT "name" FROM "categories_locales"
       WHERE "categories_locales"."_parent_id" = "categories"."id"
       AND "categories_locales"."_locale" = 'pt'::text::"_locales"),
      "categories"."name"
    );
  `)

  // 3. Restore PT description
  await db.execute(sql`
    UPDATE "categories"
    SET "description" = COALESCE(
      (SELECT "description" FROM "categories_locales"
       WHERE "categories_locales"."_parent_id" = "categories"."id"
       AND "categories_locales"."_locale" = 'pt'::text::"_locales"),
      "categories"."description"
    );
  `)

  // 4. Drop indexes
  await db.execute(sql`DROP INDEX IF EXISTS "categories_locales_name_locale_unique";`)
  await db.execute(sql`DROP INDEX IF EXISTS "categories_locales_locale_parent_id_unique";`)

  // 5. Drop FK constraint
  await db.execute(sql`ALTER TABLE "categories_locales" DROP CONSTRAINT IF EXISTS "categories_locales_parent_id_fk";`)

  // 6. Drop the locales table
  await db.execute(sql`DROP TABLE IF EXISTS "categories_locales";`)
}