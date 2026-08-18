import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

export async function up({ db }: MigrateArgs): Promise<void> {
  await db.execute(sql`DO $$ BEGIN
    CREATE TYPE "public"."enum_stock_reservations_status" AS ENUM('active', 'confirmed', 'expired', 'released');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`)

  await db.execute(sql`
    CREATE TABLE "stock_reservations" (
      "id" serial PRIMARY KEY NOT NULL,
      "flower_id" integer NOT NULL,
      "quantity" integer DEFAULT 1 NOT NULL,
      "status" "enum_stock_reservations_status" DEFAULT 'active' NOT NULL,
      "idempotency_key_hash" varchar NOT NULL,
      "order_id" integer,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "confirmed_at" timestamp(3) with time zone,
      "expired_at" timestamp(3) with time zone,
      "released_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_flower_fk" FOREIGN KEY ("flower_id") REFERENCES "public"."flowers"("id") ON DELETE cascade ON UPDATE no action;`)
  await db.execute(sql`ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;`)

  await db.execute(sql`CREATE UNIQUE INDEX "stock_reservations_idempotency_key_unique" ON "stock_reservations" USING btree ("idempotency_key_hash");`)
  await db.execute(sql`CREATE INDEX "stock_reservations_flower_idx" ON "stock_reservations" USING btree ("flower_id");`)
  await db.execute(sql`CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations" USING btree ("status");`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM "stock_reservations";`)
  const count = result?.rows?.[0]?.cnt ?? 0
  if (count > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${count} reservation(s) found in stock_reservations. ` +
      `Ensure backup is available before rolling back.`
    )
  }

  await db.execute(sql`DROP TABLE IF EXISTS "stock_reservations";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_stock_reservations_status";`)
}