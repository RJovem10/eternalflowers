import { sql } from '@payloadcms/db-postgres'

interface MigrateArgs {
  db: any
  payload: any
  req: any
}

/**
 * HOTFIX realflowers-payload-save — Correção da tabela array do Global Homepage.
 *
 * Problema em produção:
 *   A migration 20260826_083000_commercial_content_cms criou a tabela
 *   "homepage_real_flowers_flowers" com:
 *     - "id" serial PRIMARY KEY        → ERRO. O Payload gera IDs hex string
 *                                        (24 chars, tipo ObjectID) para array rows.
 *                                        O save falha com
 *                                        "invalid input syntax for type integer"
 *     - "name" varchar NOT NULL        → ERRO. "name" é localized:true. O Payload
 *                                        nativo NÃO mantém a coluna na tabela
 *                                        principal (o valor vive na _locales).
 *
 * Referência do schema nativo Payload (baseline, flowers_images array):
 *   "id" varchar PRIMARY KEY NOT NULL
 *
 * Objetivo estrutural pós-fix:
 *   homepage_real_flowers_flowers:
 *     - _order integer NOT NULL
 *     - _parent_id integer NOT NULL  (referencia homepage.id — integer)
 *     - id varchar(24) PRIMARY KEY NOT NULL
 *     - scientific_name varchar NOT NULL
 *     - image_id integer (nullable)
 *     (NÃO tem "name" — é localized, vive em _locales)
 *
 *   homepage_real_flowers_flowers_locales:
 *     - id serial PRIMARY KEY NOT NULL
 *     - name varchar NOT NULL
 *     - _locale "_locales" NOT NULL
 *     - _parent_id varchar(24) NOT NULL  (referencia a tabela array .id — varchar)
 *
 * Guardas:
 *   - verifica existência das tabelas;
 *   - NÃO apaga Media, Homepage nem conteúdo editorial;
 *   - aborta se existirem rows na tabela array que seriam inviabilizadas pela
 *     mudança de tipo (data loss);
 *   - seed das 6 flores legacy é feito APENAS se o array estiver vazio e a
 *     homepage existir.
 *
 * DOWN: reversível APENAS quando o array está vazio.
 *   - Guards: ABORTA se ANY row existir (não apaga editorial nem converte IDs).
 *   - Restaura schema original: id serial/sequence, name varchar NOT NULL, FK integer→integer.
 */
export async function up({ db }: MigrateArgs): Promise<void> {
  const flowersTable = await db.execute(
    sql`SELECT to_regclass('public.homepage_real_flowers_flowers') AS exists;`,
  )
  if (!flowersTable?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "homepage_real_flowers_flowers" does not exist (run the original migration first).')
  }
  const localesTable = await db.execute(
    sql`SELECT to_regclass('public.homepage_real_flowers_flowers_locales') AS exists;`,
  )
  if (!localesTable?.rows?.[0]?.exists) {
    throw new Error('[UP] Table "homepage_real_flowers_flowers_locales" does not exist (run the original migration first).')
  }

  // ── 0. Guards de data-loss ──────────────────────────────────────────────
  // Se existirem rows na tabela array, a mudança de tipo "id" de integer→varchar
  // seria inviável. Neste bug os rows never chegam a ser inseridos (o save falha),
  // por isso em produção existem 0 rows. Se alguém inseriu dados válidos manualmente,
  // abortamos para evitar destruí-los.
  const rowCount = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM "homepage_real_flowers_flowers";`,
  )
  const cnt = rowCount?.rows?.[0]?.cnt ?? 0
  if (cnt > 0) {
    throw new Error(
      `[UP] ABORTED: ${cnt} row(s) already exist in "homepage_real_flowers_flowers". ` +
        'Refusing to alter id type on non-empty array table to avoid data loss.',
    )
  }

  // ── 1. Drop FK da locales para a tabela array (referencia o id que muda) ──
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers_locales" DROP CONSTRAINT IF EXISTS "homepage_real_flowers_flowers_locales__parent_id_fkey";`,
  )

  // ── 2. Corrigir a tabela principal ───────────────────────────────────────
  // 2a. Drop PK para poder mudar o tipo do id
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" DROP CONSTRAINT IF EXISTS "homepage_real_flowers_flowers_pkey";`,
  )
  // 2b. Drop default da sequence (serial) e converte para varchar(24)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ALTER COLUMN "id" DROP DEFAULT;`,
  )
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ALTER COLUMN "id" TYPE varchar(24) USING "id"::text;`,
  )
  // 2c. Volta a aplicar PK em varchar
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ADD CONSTRAINT "homepage_real_flowers_flowers_pkey" PRIMARY KEY ("id");`,
  )
  // 2d. Remove a sequence órfã
  await db.execute(
    sql`DROP SEQUENCE IF EXISTS "homepage_real_flowers_flowers_id_seq";`,
  )
  // 2e. Remove a coluna "name" (localized → vive em _locales; logo, nem existe na principal)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" DROP COLUMN IF EXISTS "name";`,
  )

  // ── 3. Corrigir a tabela _locales ────────────────────────────────────────
  // O "_parent_id" referencia homepage_real_flowers_flowers.id — que agora é varchar(24)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers_locales" ALTER COLUMN "_parent_id" TYPE varchar(24) USING "_parent_id"::text;`,
  )
  // Re-criar a FK (aponta para o novo id varchar)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers_locales" ADD CONSTRAINT "homepage_real_flowers_flowers_locales__parent_id_fkey" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_real_flowers_flowers"("id") ON DELETE CASCADE ON UPDATE no action;`,
  )

  // ── 4. Seed das 6 flores legacy (APENAS se array vazio e homepage existir) ──
  await seedLegacyFlowers(db)
}

/** Seed condicional das 6 flores legacy — nunca sobrescreve conteúdo editoral. */
async function seedLegacyFlowers(db: any): Promise<void> {
  // Array deve estar vazio (idempotente — nunca duplica após primeira seed)
  const countRes = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM "homepage_real_flowers_flowers";`,
  )
  const cnt = countRes?.rows?.[0]?.cnt ?? 0
  if (cnt > 0) {
    // Já existe conteúdo → não mexer
    return
  }

  // A homepage (Global) tem de existir — senão a FK _parent_id falharia.
  // Se o row ainda não existir (migração a correr antes do Payload boot),
  // criamo-lo com os valores mínimos obrigatórios.
  const hpRes = await db.execute(
    sql`SELECT "id" FROM "homepage" ORDER BY "id" LIMIT 1;`,
  )
  let hpId = hpRes?.rows?.[0]?.id
  if (hpId === undefined || hpId === null) {
    await db.execute(
      sql`INSERT INTO "homepage" ("id", "hero_primary_button_link", "instagram_handle", "cta_button_link", "hero_hero_image_position")
          VALUES (1, '/catalog', '@eternalflowers', '/contact', 'center 30%')
          ON CONFLICT (id) DO NOTHING;`,
    )
    hpId = 1
  }

  const flowers = [
    { order: 1, id: 'seed_vanda_0001', name: 'Orquídea Vanda', scientificName: 'Vanda coerulea' },
    { order: 2, id: 'seed_paphiopedilum_0002', name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio' },
    { order: 3, id: 'seed_sobralia_0003', name: 'Sobrália', scientificName: 'Sobralia rosea' },
    { order: 4, id: 'seed_cambria_0004', name: 'Cambria', scientificName: 'Cambria Africana' },
    { order: 5, id: 'seed_laelia_0005', name: 'Laelia', scientificName: 'Laelia purpurata' },
    { order: 6, id: 'seed_cattleya_0006', name: 'Cattleya', scientificName: 'Cattleya spp.' },
  ]

  for (const f of flowers) {
    // Tabela principal (não-localized fields; name NÃO vai aqui)
    await db.execute(
      sql`INSERT INTO "homepage_real_flowers_flowers" ("_order", "_parent_id", "id", "scientific_name")
          VALUES (${f.order}, ${hpId}, ${f.id}, ${f.scientificName});`,
    )
    // Locale PT do name
    await db.execute(
      sql`INSERT INTO "homepage_real_flowers_flowers_locales" ("name", "_locale", "_parent_id")
          VALUES (${f.name}, 'pt'::text::"_locales", ${f.id});`,
    )
  }
}

export async function down({ db }: MigrateArgs): Promise<void> {
  const flowersTable = await db.execute(
    sql`SELECT to_regclass('public.homepage_real_flowers_flowers') AS exists;`,
  )
  if (!flowersTable?.rows?.[0]?.exists) {
    return // nothing to undo
  }

  // ── 0. DATA-LOSS GUARD — fazer TODAS as verificações ANTES de qualquer DELETE/ALTER ──
  // A Marina pode ter editado rows seeded; nesse momento são conteúdo editorial real.
  // Independemente do prefixo do id, se existir QUALQUER row, o DOWN é inviável:
  //   - NÃO podem ser apagadas automaticamente; e
  //   - os IDs Payload (hex 24 chars) não são convertíveis para integer.
  // Se o array (ou a locales correspondente) tiver qualquer row, ABORTAR.
  const rowCount = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM "homepage_real_flowers_flowers";`,
  )
  const cnt = rowCount?.rows?.[0]?.cnt ?? 0
  if (cnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${cnt} row(s) exist in "homepage_real_flowers_flowers". ` +
        'Cannot convert Payload varchar ids to integer nor delete editorial content. ' +
        'Empty the array (and its _locales children) through the Payload admin before rolling back.',
    )
  }
  const localesCount = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM "homepage_real_flowers_flowers_locales";`,
  )
  const lcnt = localesCount?.rows?.[0]?.cnt ?? 0
  if (lcnt > 0) {
    throw new Error(
      `[DOWN] ABORTED: ${lcnt} row(s) exist in "homepage_real_flowers_flowers_locales". ` +
        'Orphan locale rows would be fatal after restoring the integer schema.',
    )
  }

  // Só aqui, com o array e locales vazios, se faz a restauração estrutural.
  // ── 1. Drop FK da locales (aponta para o id varchar) ────────────────
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers_locales" DROP CONSTRAINT IF EXISTS "homepage_real_flowers_flowers_locales__parent_id_fkey";`,
  )
  // ── 2. Converter _parent_id da locales de varchar(24) → integer ─────
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers_locales" ALTER COLUMN "_parent_id" TYPE integer USING NULLIF("_parent_id", '')::integer;`,
  )
  // ── 3. Tabela principal: id → integer serial ────────────────────────
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" DROP CONSTRAINT IF EXISTS "homepage_real_flowers_flowers_pkey";`,
  )
  // Drop default/sequence actual (varchar não tem default agora, mas por segurança)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ALTER COLUMN "id" DROP DEFAULT;`,
  )
  // Converter id → integer (array está vazio, cast é seguro)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ALTER COLUMN "id" TYPE integer USING NULL::integer;`,
  )
  // Recriar a sequence, associar (OWNED BY) e colocar como DEFAULT nextval
  await db.execute(
    sql`CREATE SEQUENCE IF NOT EXISTS "homepage_real_flowers_flowers_id_seq" OWNED BY "homepage_real_flowers_flowers"."id";`,
  )
  await db.execute(
    sql`SELECT setval('"homepage_real_flowers_flowers_id_seq"', COALESCE((SELECT MAX("id") FROM "homepage_real_flowers_flowers"), 1));`,
  )
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ALTER COLUMN "id" SET DEFAULT nextval('"homepage_real_flowers_flowers_id_seq"'::regclass);`,
  )
  // Re-aplicar PK em integer
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers" ADD CONSTRAINT "homepage_real_flowers_flowers_pkey" PRIMARY KEY ("id");`,
  )
  // Re-adicionar coluna "name" — NOT NULL tal como a migration original criou.
  // Como o array está vazio, ADD COLUMN NOT NULL é aceite sem DEFAULT.
  const nameCol = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'homepage_real_flowers_flowers' AND column_name = 'name';`,
  )
  if (nameCol?.rows?.[0]?.cnt === 0) {
    await db.execute(
      sql`ALTER TABLE "homepage_real_flowers_flowers" ADD COLUMN "name" varchar NOT NULL;`,
    )
  }
  // Re-criar a FK original (integer → integer)
  await db.execute(
    sql`ALTER TABLE "homepage_real_flowers_flowers_locales" ADD CONSTRAINT "homepage_real_flowers_flowers_locales__parent_id_fkey" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_real_flowers_flowers"("id") ON DELETE CASCADE ON UPDATE no action;`,
  )
}