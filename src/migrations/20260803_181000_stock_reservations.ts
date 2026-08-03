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
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`stock_reservations\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`flower_id\` integer NOT NULL,
    \`quantity\` integer DEFAULT 1 NOT NULL,
    \`status\` text DEFAULT 'active' NOT NULL,
    \`idempotency_key_hash\` text NOT NULL,
    \`order_id\` integer,
    \`expires_at\` text NOT NULL,
    \`confirmed_at\` text,
    \`expired_at\` text,
    \`released_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`flower_id\`) REFERENCES \`flowers\`(\`id\`) ON DELETE cascade ON UPDATE no action,
    FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE set null ON UPDATE no action
  );`)

  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`stock_reservations_idempotency_key_unique\` ON \`stock_reservations\` (\`idempotency_key_hash\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`stock_reservations_flower_idx\` ON \`stock_reservations\` (\`flower_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`stock_reservations_status_idx\` ON \`stock_reservations\` (\`status\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = await db.get(sql`SELECT COUNT(*) AS cnt FROM \`stock_reservations\`;`)
  if (result?.cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${result.cnt} reservation(s) found in stock_reservations. ` +
      `This DOWN would destroy that data. Ensure backup is available before rolling back.`
    )
  }
  await db.run(sql`DROP TABLE IF EXISTS \`stock_reservations\`;`)
}