import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * ISSUE-1Q — Adiciona campo cancelledAt à tabela orders (PostgreSQL)
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  // Verificar se a coluna já existe
  const colCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancelled_at';
  `)
  if (colCheck?.rows?.length > 0) {
    throw new Error('[UP] Column "cancelled_at" already exists on "orders". Migration already applied.')
  }

  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamptz;`)
}

export async function down({ db }: MigrateArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelled_at";`)
}