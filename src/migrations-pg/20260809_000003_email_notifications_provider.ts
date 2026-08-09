import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1P — Adiciona campos provider e providerMessageId à email_notifications (PostgreSQL)
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verificar se as colunas já existem (PG — information_schema)
  const columnsResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'email_notifications'
      AND column_name IN ('provider', 'provider_message_id');
  `)
  const existingColumns: string[] = (columnsResult?.rows || []).map(
    (r: any) => r.column_name,
  )

  if (!existingColumns.includes('provider')) {
    await db.execute(sql`
      ALTER TABLE "email_notifications"
      ADD COLUMN "provider" varchar;
    `)
  }

  if (!existingColumns.includes('provider_message_id')) {
    await db.execute(sql`
      ALTER TABLE "email_notifications"
      ADD COLUMN "provider_message_id" varchar;
    `)
  }
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // Verificar se as colunas existem antes de dropar
  const columnsResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'email_notifications'
      AND column_name IN ('provider', 'provider_message_id');
  `)
  const existingColumns: string[] = (columnsResult?.rows || []).map(
    (r: any) => r.column_name,
  )

  if (existingColumns.includes('provider')) {
    await db.execute(sql`
      ALTER TABLE "email_notifications"
      DROP COLUMN IF EXISTS "provider";
    `)
  }

  if (existingColumns.includes('provider_message_id')) {
    await db.execute(sql`
      ALTER TABLE "email_notifications"
      DROP COLUMN IF EXISTS "provider_message_id";
    `)
  }
}