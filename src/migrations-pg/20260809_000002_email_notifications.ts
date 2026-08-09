import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1O — Email Notifications table (PostgreSQL)
 *
 * Creates the email_notifications collection table for transactional
 * email outbox pattern.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verify table doesn't already exist
  const tableCheck = await db.execute(sql`
    SELECT to_regclass('public.email_notifications') AS exists;
  `)
  if (tableCheck?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "email_notifications" already exists. Migration already applied.')
  }

  // Create email_notifications table
  await db.execute(sql`
    CREATE TABLE "email_notifications" (
      "id" serial PRIMARY KEY NOT NULL,
      "type" varchar NOT NULL DEFAULT 'order_confirmed',
      "order_id" integer NOT NULL REFERENCES "orders"("id"),
      "recipient_email" varchar NOT NULL,
      "locale" varchar NOT NULL DEFAULT 'pt',
      "status" varchar NOT NULL DEFAULT 'pending',
      "deduplication_key" varchar NOT NULL,
      "attempt_count" integer NOT NULL DEFAULT 0,
      "last_error" varchar,
      "sent_at" timestamptz,
      "payload" jsonb,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    );
  `)

  // Create indexes
  await db.execute(sql`
    CREATE UNIQUE INDEX "email_notifications_deduplication_key_idx"
    ON "email_notifications" USING btree ("deduplication_key");
  `)

  await db.execute(sql`
    CREATE INDEX "email_notifications_status_idx"
    ON "email_notifications" USING btree ("status");
  `)

  await db.execute(sql`
    CREATE INDEX "email_notifications_order_idx"
    ON "email_notifications" USING btree ("order_id");
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const tableCheck = await db.execute(sql`
    SELECT to_regclass('public.email_notifications') AS exists;
  `)
  if (!tableCheck?.rows?.[0]?.exists) {
    return
  }

  await db.execute(sql`DROP INDEX IF EXISTS "email_notifications_deduplication_key_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "email_notifications_status_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "email_notifications_order_idx";`)
  await db.execute(sql`DROP TABLE IF EXISTS "email_notifications";`)
}