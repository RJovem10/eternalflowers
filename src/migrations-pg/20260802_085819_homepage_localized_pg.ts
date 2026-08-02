import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db, payload, req }: MigrateArgs): Promise<void> {
  const hpCheck = await db.execute(sql`SELECT to_regclass('public.homepage') AS exists;`)
  if (!hpCheck?.rows?.[0]?.exists) throw new Error('[UP] Table "homepage" does not exist.')

  const localesCheck = await db.execute(sql`SELECT to_regclass('public.homepage_locales') AS exists;`)
  if (localesCheck?.rows?.[0]?.exists) throw new Error('[UP] Table "homepage_locales" already exists.')

  await db.execute(sql`
    CREATE TABLE "homepage_locales" (
      "hero_hero_title" varchar NOT NULL,
      "hero_hero_subtitle" varchar NOT NULL,
      "hero_primary_button_text" varchar NOT NULL,
      "hero_secondary_button_text" varchar,
      "real_flowers_title" varchar NOT NULL,
      "real_flowers_subtitle" varchar,
      "story_title" varchar NOT NULL,
      "story_text" varchar NOT NULL,
      "international_title" varchar NOT NULL,
      "international_subtitle" varchar,
      "instagram_title" varchar NOT NULL,
      "instagram_text" varchar,
      "cta_title" varchar NOT NULL,
      "cta_subtitle" varchar,
      "cta_button_text" varchar NOT NULL,
      "footer_brand_description" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );
  `)

  await db.execute(sql`
    ALTER TABLE "homepage_locales"
    ADD CONSTRAINT "homepage_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id")
    REFERENCES "public"."homepage"("id")
    ON DELETE cascade
    ON UPDATE no action;
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX "homepage_locales_locale_parent_id_unique"
    ON "homepage_locales" USING btree ("_locale", "_parent_id");
  `)

  await db.execute(sql`
    INSERT INTO "homepage_locales" (
      "hero_hero_title", "hero_hero_subtitle", "hero_primary_button_text", "hero_secondary_button_text",
      "real_flowers_title", "real_flowers_subtitle",
      "story_title", "story_text",
      "international_title", "international_subtitle",
      "instagram_title", "instagram_text",
      "cta_title", "cta_subtitle", "cta_button_text",
      "footer_brand_description", "_locale", "_parent_id"
    )
    SELECT
      "hero_hero_title", "hero_hero_subtitle", "hero_primary_button_text", "hero_secondary_button_text",
      "real_flowers_title", "real_flowers_subtitle",
      "story_title", "story_text",
      "international_title", "international_subtitle",
      "instagram_title", "instagram_text",
      "cta_title", "cta_subtitle", "cta_button_text",
      "footer_brand_description", 'pt'::text::"_locales", "id"
    FROM "homepage"
    WHERE "hero_hero_title" IS NOT NULL AND "hero_hero_title" != '';
  `)

  const countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "homepage_locales";`)
  const count = countResult?.rows?.[0]?.cnt ?? 0
  if (count < 1) throw new Error('[UP] Backfill inserted 0 rows.')
}

export async function down({ db, payload, req }: MigrateArgs): Promise<void> {
  const nonPtResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "homepage_locales" WHERE "_locale" != 'pt'::text::"_locales";
  `)
  const nonPtCount = nonPtResult?.rows?.[0]?.cnt ?? 0
  if (nonPtCount > 0) throw new Error(`[DOWN] ABORTED: ${nonPtCount} non-PT locale row(s) found.`)

  await db.execute(sql`
    UPDATE "homepage" SET
      "hero_hero_title" = COALESCE((SELECT "hero_hero_title" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."hero_hero_title"),
      "hero_hero_subtitle" = COALESCE((SELECT "hero_hero_subtitle" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."hero_hero_subtitle"),
      "hero_primary_button_text" = COALESCE((SELECT "hero_primary_button_text" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."hero_primary_button_text"),
      "hero_secondary_button_text" = COALESCE((SELECT "hero_secondary_button_text" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."hero_secondary_button_text"),
      "real_flowers_title" = COALESCE((SELECT "real_flowers_title" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."real_flowers_title"),
      "real_flowers_subtitle" = COALESCE((SELECT "real_flowers_subtitle" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."real_flowers_subtitle"),
      "story_title" = COALESCE((SELECT "story_title" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."story_title"),
      "story_text" = COALESCE((SELECT "story_text" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."story_text"),
      "international_title" = COALESCE((SELECT "international_title" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."international_title"),
      "international_subtitle" = COALESCE((SELECT "international_subtitle" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."international_subtitle"),
      "instagram_title" = COALESCE((SELECT "instagram_title" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."instagram_title"),
      "instagram_text" = COALESCE((SELECT "instagram_text" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."instagram_text"),
      "cta_title" = COALESCE((SELECT "cta_title" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."cta_title"),
      "cta_subtitle" = COALESCE((SELECT "cta_subtitle" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."cta_subtitle"),
      "cta_button_text" = COALESCE((SELECT "cta_button_text" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."cta_button_text"),
      "footer_brand_description" = COALESCE((SELECT "footer_brand_description" FROM "homepage_locales" WHERE "homepage_locales"."_parent_id" = "homepage"."id" AND "homepage_locales"."_locale" = 'pt'::text::"_locales"), "homepage"."footer_brand_description");
  `)

  await db.execute(sql`DROP INDEX IF EXISTS "homepage_locales_locale_parent_id_unique";`)
  await db.execute(sql`ALTER TABLE "homepage_locales" DROP CONSTRAINT IF EXISTS "homepage_locales_parent_id_fk";`)
  await db.execute(sql`DROP TABLE IF EXISTS "homepage_locales";`)
}