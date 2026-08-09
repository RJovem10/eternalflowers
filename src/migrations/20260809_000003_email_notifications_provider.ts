import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1P — Adiciona campos provider e providerMessageId à email_notifications (SQLite)
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verificar se as colunas já existem
  const tableInfo = await db.all(sql`
    PRAGMA table_info("email_notifications");
  `)
  const existingColumns = (tableInfo || []).map((r: any) => r.name)

  if (!existingColumns.includes('provider')) {
    await db.run(sql`
      ALTER TABLE "email_notifications"
      ADD COLUMN "provider" varchar;
    `)
  }

  if (!existingColumns.includes('provider_message_id')) {
    await db.run(sql`
      ALTER TABLE "email_notifications"
      ADD COLUMN "provider_message_id" varchar;
    `)
  }
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('email_notifications')
    WHERE name IN ('provider', 'provider_message_id');
  `)
  if (!colCheck?.cnt) {
    // Already clean — nothing to do
    return
  }

  await db.run(sql`ALTER TABLE "email_notifications" DROP COLUMN "provider";`)
  await db.run(sql`ALTER TABLE "email_notifications" DROP COLUMN "provider_message_id";`)
}