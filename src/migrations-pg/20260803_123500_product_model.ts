import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db }: MigrateArgs): Promise<void> {
  // 1. Verify flowers table exists
  const check = await db.execute(sql`SELECT to_regclass('public.flowers') AS exists;`)
  if (!check?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "flowers" does not exist. Run E1 baseline migration first.')
  }

  // 2. Add production_mode (nullable — produtos demo podem ficar sem classificar)
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "production_mode" varchar;`)

  // 3. Add production_lead_time (nullable — só para made_to_order)
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "production_lead_time" integer;`)

  // 4. Add stock_quantity (0 default — produtos demo recebem 0)
  await db.execute(sql`ALTER TABLE "flowers" ADD COLUMN "stock_quantity" integer DEFAULT 0 NOT NULL;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // Pre-check: ABORT if any product has productionMode filled (would lose data)
  const filledCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM "flowers" WHERE "production_mode" IS NOT NULL;
  `)
  const count = filledCheck?.rows?.[0]?.cnt ?? 0
  if (count > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${count} product(s) have productionMode filled. ` +
      `This DOWN would destroy that data. Ensure backup is available before rolling back.`
    )
  }

  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "stock_quantity";`)
  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "production_lead_time";`)
  await db.execute(sql`ALTER TABLE "flowers" DROP COLUMN "production_mode";`)
}