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

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add productionMode (nullable — produtos demo podem ficar sem classificar)
  await db.run(sql`ALTER TABLE \`flowers\` ADD COLUMN \`production_mode\` text;`)

  // Add productionLeadTime (nullable — só para made_to_order)
  await db.run(sql`ALTER TABLE \`flowers\` ADD COLUMN \`production_lead_time\` integer;`)

  // Add stockQuantity (0 default — produtos demo recebem 0)
  await db.run(sql`ALTER TABLE \`flowers\` ADD COLUMN \`stock_quantity\` integer DEFAULT 0 NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Pre-check: ABORT if any product has productionMode filled (would lose data)
  const filledCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM \`flowers\` WHERE \`production_mode\` IS NOT NULL;
  `)
  if (filledCheck?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${filledCheck.cnt} product(s) have productionMode filled. ` +
      `This DOWN would destroy that data. Ensure backup is available before rolling back.`
    )
  }

  await db.run(sql`ALTER TABLE \`flowers\` DROP COLUMN \`stock_quantity\`;`)
  await db.run(sql`ALTER TABLE \`flowers\` DROP COLUMN \`production_lead_time\`;`)
  await db.run(sql`ALTER TABLE \`flowers\` DROP COLUMN \`production_mode\`;`)
}