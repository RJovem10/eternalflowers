import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1O — Email Notifications table (SQLite)
 *
 * Creates the email_notifications collection table for transactional
 * email outbox pattern.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify table doesn't already exist
  const tableCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM sqlite_master
    WHERE type='table' AND name='email_notifications';
  `)
  if (tableCheck?.cnt > 0) {
    throw new Error('[UP] Table "email_notifications" already exists. Migration already applied.')
  }

  // Create email_notifications table
  await db.run(sql`
    CREATE TABLE "email_notifications" (
      "id" integer PRIMARY KEY NOT NULL,
      "type" varchar NOT NULL DEFAULT 'order_confirmed',
      "order_id" integer NOT NULL REFERENCES "orders"("id"),
      "recipient_email" varchar NOT NULL,
      "locale" varchar NOT NULL DEFAULT 'pt',
      "status" varchar NOT NULL DEFAULT 'pending',
      "deduplication_key" varchar NOT NULL,
      "attempt_count" integer NOT NULL DEFAULT 0,
      "last_error" varchar,
      "sent_at" timestamptz,
      "payload" json,
      "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `)

  // Create indexes
  await db.run(sql`
    CREATE UNIQUE INDEX "email_notifications_deduplication_key_idx"
    ON "email_notifications"("deduplication_key");
  `)

  await db.run(sql`
    CREATE INDEX "email_notifications_status_idx"
    ON "email_notifications"("status");
  `)

  await db.run(sql`
    CREATE INDEX "email_notifications_order_idx"
    ON "email_notifications"("order_id");
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const tableCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM sqlite_master
    WHERE type='table' AND name='email_notifications';
  `)
  if (!tableCheck?.cnt) {
    return
  }

  await db.run(sql`DROP INDEX IF EXISTS "email_notifications_deduplication_key_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "email_notifications_status_idx";`)
  await db.run(sql`DROP INDEX IF EXISTS "email_notifications_order_idx";`)
  await db.run(sql`DROP TABLE "email_notifications";`)
}