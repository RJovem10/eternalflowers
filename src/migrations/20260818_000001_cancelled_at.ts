import { sql } from '@payloadcms/db-sqlite'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1Q — Adiciona campo cancelledAt à tabela orders (SQLite)
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verificar se a coluna já existe
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name = 'cancelled_at';
  `)
  if (colCheck?.cnt > 0) {
    throw new Error('[UP] Column "cancelled_at" already exists on "orders". Migration already applied.')
  }

  await db.run(sql`
    ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamptz;
  `)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  // SQLite ALTER TABLE DROP COLUMN is supported since 3.35.0
  const colCheck = await db.get(sql`
    SELECT COUNT(*) AS cnt FROM pragma_table_info('orders')
    WHERE name = 'cancelled_at';
  `)
  if (!colCheck?.cnt) return

  await db.run(sql`ALTER TABLE "orders" DROP COLUMN "cancelled_at";`)
}