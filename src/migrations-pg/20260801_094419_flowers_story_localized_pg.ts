import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Verify flowers exists
  const flowersCheck = await db.execute(sql`SELECT to_regclass('public.flowers') AS exists;`)
  if (!flowersCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "flowers" does not exist. Run E1 baseline migration first.')
  }

  // 2. Verify flowers.story exists
  const storyCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'flowers' AND column_name = 'story';
  `)
  if (!storyCheck?.rows?.length) {
    throw new Error('[UP] Column "flowers.story" does not exist. E1 schema not found.')
  }

  // 3. Verify flowers_locales does NOT already exist
  const localesCheck = await db.execute(sql`SELECT to_regclass('public.flowers_locales') AS exists;`)
  if (localesCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "flowers_locales" already exists. Migration already applied or schema is in an unexpected state.')
  }

  // 4. Create flowers_locales table matching Payload 3.86 generated schema
  await db.execute(sql`
    CREATE TABLE "flowers_locales" (
      "story" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
  `)

  // 5. Add foreign key constraint
  await db.execute(sql`
    ALTER TABLE "flowers_locales"
    ADD CONSTRAINT "flowers_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id")
    REFERENCES "public"."flowers"("id")
    ON DELETE cascade
    ON UPDATE no action;
  `)

  // 6. Create unique index on (_locale, _parent_id)
  await db.execute(sql`
    CREATE UNIQUE INDEX "flowers_locales_locale_parent_id_unique"
    ON "flowers_locales" USING btree ("_locale", "_parent_id");
  `)

  // 7. Backfill PT stories — copy non-empty story values
  const insertResult = await db.execute(sql`
    INSERT INTO "flowers_locales" ("story", "_locale", "_parent_id")
    SELECT "story", 'pt'::text::"_locales", "id"
    FROM "flowers"
    WHERE "story" IS NOT NULL AND "story" != '';
  `)

  // 8. Confirm backfill count
  const countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "flowers_locales";`)
  const count = countResult?.rows?.[0]?.cnt ?? 0
  if (count < 1) {
    throw new Error(`[UP] Backfill inserted 0 rows — no flowers with non-empty story found.`)
  }

  // Drop old localized column from base table
  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "story";`);
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  // 1. Pre-check: ABORT if any non-PT translations exist
  const nonPtResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "flowers_locales" WHERE "_locale" != 'pt'::text::"_locales";
  `)
  const nonPtCount = nonPtResult?.rows?.[0]?.cnt ?? 0
  if (nonPtCount > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${nonPtCount} non-PT locale row(s) found in flowers_locales. ` +
      `This DOWN would destroy those translations. ` +
      `Use the pre-migration backup for rollback, or write a preservation migration first.`
    )
  }

  // 2. Recreate the dropped column before restoring data
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "story" varchar;`)

  // 3. Restore PT stories — only rows that had non-empty story
  await db.execute(sql`
    UPDATE "flowers"
    SET "story" = COALESCE(
      (SELECT "story" FROM "flowers_locales"
       WHERE "flowers_locales"."_parent_id" = "flowers"."id"
       AND "flowers_locales"."_locale" = 'pt'::text::"_locales"),
      "flowers"."story"
    );
  `)

  // 4. Drop the unique index
  await db.execute(sql`
    DROP INDEX IF EXISTS "flowers_locales_locale_parent_id_unique";
  `)

  // 5. Drop the foreign key constraint
  await db.execute(sql`
    ALTER TABLE "flowers_locales" DROP CONSTRAINT IF EXISTS "flowers_locales_parent_id_fk";
  `)

  // 6. Drop the locales table (cascades the sequence)
  await db.execute(sql`
    DROP TABLE IF EXISTS "flowers_locales";
  `)
}