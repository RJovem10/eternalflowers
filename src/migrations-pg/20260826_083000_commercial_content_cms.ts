import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-3 — Commercial/Visual Content CMS (PostgreSQL)
 *
 * UP:
 *   1. Adds hero_hero_image_position column to homepage (select, default 'center 30%')
 *   2. Creates homepage_real_flowers_flowers array table for flowers in realFlowers group
 *   3. Adds icon, image_id, sort_order, is_active columns to categories
 *   4. Creates site_settings global table
 *
 * DOWN: Reverses all changes with data-loss guards.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Homepage — heroImagePosition
  // ──────────────────────────────────────────────────────────────────────────
  const hpTable = await db.execute(sql`SELECT to_regclass('public.homepage') AS exists;`)
  if (!hpTable?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "homepage" does not exist.')
  }

  const hpColCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'homepage'
    AND column_name = 'hero_hero_image_position';
  `)
  if (hpColCheck?.rows?.[0]?.cnt === 0) {
    await db.execute(sql`ALTER TABLE "homepage" ADD COLUMN "hero_hero_image_position" varchar DEFAULT 'center 30%' NOT NULL;`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Homepage — realFlowers.flowers array table
  // ──────────────────────────────────────────────────────────────────────────
  const flowersTable = await db.execute(sql`SELECT to_regclass('public.homepage_real_flowers_flowers') AS exists;`)
  if (!flowersTable?.rows?.[0]?.exists) {
    await db.execute(sql`
      CREATE TABLE "homepage_real_flowers_flowers" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL REFERENCES "public"."homepage"("id") ON DELETE CASCADE,
        "id" serial PRIMARY KEY,
        "name" varchar NOT NULL,
        "scientific_name" varchar NOT NULL,
        "image_id" integer REFERENCES "public"."media"("id") ON DELETE SET NULL
      );
    `)
    await db.execute(sql`CREATE INDEX "homepage_real_flowers_flowers_parent_id_idx" ON "homepage_real_flowers_flowers"("_parent_id");`)

    // Create locales table for the localized "name" field
    await db.execute(sql`
      CREATE TABLE "homepage_real_flowers_flowers_locales" (
        "name" varchar NOT NULL,
        "_locale" "_locales" NOT NULL,
        "_parent_id" integer NOT NULL REFERENCES "public"."homepage_real_flowers_flowers"("id") ON DELETE CASCADE,
        "id" serial PRIMARY KEY
      );
    `)
    await db.execute(sql`
      CREATE UNIQUE INDEX "homepage_real_flowers_flowers_locales_locale_parent_id_unique"
      ON "homepage_real_flowers_flowers_locales" USING btree ("_locale", "_parent_id");
    `)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Categories — icon, image, sortOrder, isActive
  // ──────────────────────────────────────────────────────────────────────────
  const catTable = await db.execute(sql`SELECT to_regclass('public.categories') AS exists;`)
  if (!catTable?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "categories" does not exist.')
  }

  const iconCol = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'icon';
  `)
  if (iconCol?.rows?.[0]?.cnt === 0) {
    await db.execute(sql`ALTER TABLE "categories" ADD COLUMN "icon" varchar;`)
  }

  const imageCol = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'image_id';
  `)
  if (imageCol?.rows?.[0]?.cnt === 0) {
    await db.execute(sql`ALTER TABLE "categories" ADD COLUMN "image_id" integer REFERENCES "public"."media"("id") ON DELETE SET NULL;`)
  }

  const sortCol = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'sort_order';
  `)
  if (sortCol?.rows?.[0]?.cnt === 0) {
    await db.execute(sql`ALTER TABLE "categories" ADD COLUMN "sort_order" integer DEFAULT 100;`)
  }

  const activeCol = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'is_active';
  `)
  if (activeCol?.rows?.[0]?.cnt === 0) {
    await db.execute(sql`ALTER TABLE "categories" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Site Settings global
  // ──────────────────────────────────────────────────────────────────────────
  const ssTable = await db.execute(sql`SELECT to_regclass('public.site_settings') AS exists;`)
  if (!ssTable?.rows?.[0]?.exists) {
    await db.execute(sql`
      CREATE TABLE "site_settings" (
        "id" serial PRIMARY KEY,
        "contacts_email" varchar,
        "contacts_phone" varchar,
        "contacts_whatsapp" varchar,
        "social_instagram_url" varchar,
        "social_facebook_url" varchar,
        "social_tiktok_url" varchar,
        "company_address" varchar,
        "company_postal_code" varchar,
        "company_city" varchar,
        "company_country" varchar,
        "company_company_name" varchar,
        "company_tax_id" varchar,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
    `)

    // Insert empty row — for a Global, the row must exist
    await db.execute(sql`INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;`)
  } else {
    // Verify single row exists
    const rowCheck = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "site_settings";`)
    if (rowCheck?.rows?.[0]?.cnt === 0) {
      await db.execute(sql`INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;`)
    }
  }
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // Pre-check: ABORT if any data would be lost
  // ──────────────────────────────────────────────────────────────────────────

  // Check heroImagePosition data
  const hpNonDefault = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "homepage"
    WHERE "hero_hero_image_position" IS NOT NULL AND "hero_hero_image_position" != 'center 30%';
  `)
  if (hpNonDefault?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${hpNonDefault.rows[0].cnt} homepage(s) have custom heroImagePosition. Down would destroy this data.`
    )
  }

  // Check flowers array data
  const flowersCount = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "homepage_real_flowers_flowers";
  `)
  if (flowersCount?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${flowersCount.rows[0].cnt} realFlowers entries exist. Down would destroy this data.`
    )
  }

  // Check category data
  const catIcons = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "categories" WHERE "icon" IS NOT NULL;
  `)
  if (catIcons?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${catIcons.rows[0].cnt} category icon(s) would be lost. Down would destroy this data.`
    )
  }

  const catSorts = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "categories" WHERE "sort_order" IS NOT NULL AND "sort_order" != 100;
  `)
  if (catSorts?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${catSorts.rows[0].cnt} category sort_order(s) would be lost. Down would destroy this data.`
    )
  }

  const catInactive = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "categories" WHERE "is_active" = false;
  `)
  if (catInactive?.rows?.[0]?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${catInactive.rows[0].cnt} categories have isActive=false. Down would lose visibility setting.`
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rollback
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Drop homepage_real_flowers_flowers_locales table
  await db.execute(sql`DROP TABLE IF EXISTS "homepage_real_flowers_flowers_locales" CASCADE;`)
  // Drop homepage_real_flowers_flowers table
  await db.execute(sql`DROP TABLE IF EXISTS "homepage_real_flowers_flowers" CASCADE;`)

  // 2. Drop homepage hero_hero_image_position
  await db.execute(sql`ALTER TABLE "homepage" DROP COLUMN "hero_hero_image_position";`)

  // 3. Drop categories columns
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN "icon";`)
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN "image_id";`)
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN "sort_order";`)
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN "is_active";`)

  // 4. Drop site_settings table
  await db.execute(sql`DROP TABLE IF EXISTS "site_settings" CASCADE;`)
}