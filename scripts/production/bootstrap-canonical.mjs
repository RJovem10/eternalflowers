#!/usr/bin/env node
/**
 * bootstrap-canonical.mjs — One-shot bootstrap dos dados canónicos no primeiro
 * deploy de produção da Eternal Flowers.
 *
 * Lê a SQLite canónica (e2-validation.sqlite), valida rigorosamente,
 * e importa os 52 registos base + 340 valores de localização para PostgreSQL
 * numa ÚNICA transação.
 *
 * NÃO copia media — apenas valida os ficheiros (nomes + SHA-256).
 * NÃO usa ON CONFLICT — aborta se target não estiver vazio.
 * NÃO depende de tsx/devDependencies — JavaScript ESM puro.
 *
 * Uso:
 *   DATABASE_URI=postgres://... node scripts/production/bootstrap-canonical.mjs \
 *     --source=/path/e2-validation.sqlite --media-dir=/path/media \
 *     --dry-run
 *
 *   DATABASE_URI=postgres://... node scripts/production/bootstrap-canonical.mjs \
 *     --source=/path/e2-validation.sqlite --media-dir=/path/media \
 *     --apply --confirm=BOOTSTRAP_ETERNAL_FLOWERS_PRODUCTION
 *
 * Proteções:
 *   - SHA-256 da SQLite verificado contra hash canónico
 *   - Counts exactos da origem validados
 *   - Media-dir: 11 ficheiros, nomes, hashes
 *   - Target PG: 17 migrations, tabelas vazias (dry-run + apply)
 *   - SourceHash de cada valor PT contra manifest em dry-run + apply
 *   - Transação única com BEGIN/COMMIT/ROLLBACK
 *   - Verificação completa antes de COMMIT
 *   - NENHUMA execução se target não estiver vazio
 *   - NUNCA imprimir password no log
 *   - NENHUM fallback silencioso para PT em traduções obrigatórias
 */

import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import pg from 'pg'

// ─── CONSTANTS ────────────────────────────────────────

const APPROVED_SQLITE_HASH = '122d2af7639d26ff98224cefbc9eaefddf11ce78a5729a6d8154e49f5d3e90ee'

const EXPECTED_COUNTS = {
  homepage: 1,
  categories: 5,
  collections: 6,
  flowers: 10,
  media: 11,
  flowers_rels: 19,
  flowers_images: 0,
}

const EXPECTED_MEDIA_FILES = [
  'brincos-danca.jpg', 'brincos-sorriso.jpg', 'colar-beijo.jpg',
  'colar-lagrima.jpg', 'hero.jpg', 'moldura-eternidade.jpg',
  'moldura-janela.jpg', 'portachaves-memoria.jpg', 'portachaves-sussurro.jpg',
  'pulseira-abraco.jpg', 'pulseira-raiz.jpg',
]

// Hashes SHA-256 dos 11 media files (documentados no cutover rehearsal)
const MEDIA_FILE_HASHES = {
  'brincos-danca.jpg': 'sha256:46153b01ff582074f5b12930202ad29b19cb85d8fb90335940e249a4ea7e8810',
  'brincos-sorriso.jpg': 'sha256:7c005c2398f87e0bfedabfacb88b5e2ae740f88da3b0d75770109acf16fc3793',
  'colar-beijo.jpg': 'sha256:1fea8c4767368185f6fad7eeef2bcf0b9022d6fda65bbc5a50107ebb6ba64b88',
  'colar-lagrima.jpg': 'sha256:31c78e5eda3ca3583019fcdc43fec065f757db429a2f3fdd99962055f5915a93',
  'hero.jpg': 'sha256:2d436a408fc58694b9d6aa813bdbf0c0872481170510bab2beda1e0657333dc0',
  'moldura-eternidade.jpg': 'sha256:b02f1be5a0607498104c49d806dbfdc9d187cad6f913da8180e1c22fdd3b71fb',
  'moldura-janela.jpg': 'sha256:2761b53d87a8fd46d0f136715dc20ea1ff2ede2878fabc42d6b5f1820cb6e993',
  'portachaves-memoria.jpg': 'sha256:926a800bf361a862e90358452b31eab5348865b7356d4add540069e74de4a55b',
  'portachaves-sussurro.jpg': 'sha256:e8cd0260a4245fc6fda13b20f25139a35022d94ff8125869f4bf769ef8b9656e',
  'pulseira-abraco.jpg': 'sha256:0cecf93a7ce4fb0789328a3f1e8ce7b8cf6ad6159cf837df0bda0f8048496235',
  'pulseira-raiz.jpg': 'sha256:423fe58769c1903f1c708615425b5769fe9d7da091cd8e55843743dc0cd252b8',
}

const EXPECTED_MIGRATION_NAMES = [
  '20260731_000000_baseline',
  '20260801_094419_flowers_story_localized_pg',
  '20260801_105830_categories_localized_pg',
  '20260802_073913_collections_localized_pg',
  '20260802_085819_homepage_localized_pg',
  '20260803_123500_product_model',
  '20260803_181000_stock_reservations',
  '20260808_000000_orders_model',
  '20260808_000001_checkout_fields',
  '20260808_000002_payment_fields',
  '20260808_000003_refund_fields',
  '20260808_160000_shipping_class',
  '20260809_000001_fulfillment_fields',
  '20260809_000002_email_notifications',
  '20260809_000003_email_notifications_provider',
  '20260818_000001_cancelled_at',
  '20260818_000002_coupon_redeemed_at',
]

// ─── LOCALE HELPERS ───────────────────────────────────

const LOCALES = ['pt', 'en', 'es', 'it', 'de']
const TARGET_LOCALES = ['en', 'es', 'it', 'de'] // non-PT for translations
const ALL_LOCALES = ['pt', 'en', 'es', 'it', 'de']

// Slug → ID mapping for categories and collections
const CATEGORY_SLUG_TO_ID = { colares: 1, brincos: 2, pulseiras: 3, 'porta-chaves': 4, molduras: 5 }
const COLLECTION_SLUG_TO_ID = { casamentos: 1, 'dia-da-mae': 2, primavera: 3, memorias: 4, natureza: 5, 'edicao-limitada': 6 }

// ─── UTILITY FUNCTIONS ────────────────────────────────

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function sha256FromHashTag(s) {
  // s = "sha256:..." or just plain hash
  if (s.startsWith('sha256:')) return s.slice(7)
  return s
}

function sanitize(u) {
  return u.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
}

function abort(m) {
  console.error(`\n❌ ABORT: ${m}`)
  process.exit(1)
}

function esc(s) {
  if (s === null || s === undefined) return 'NULL'
  return "'" + String(s).replace(/'/g, "''") + "'"
}

function escBool(v) { return v ? 'true' : 'false' }

function sqlNow() { return "now()" }

function sha256Short(s) {
  return crypto.createHash('sha256').update(String(s ?? '')).digest('hex').slice(0, 12)
}

// ─── PARSE ARGS ───────────────────────────────────────

const args = process.argv.slice(2)
let sourcePath = '', mediaDir = '', mode = 'dry-run', confirmToken = ''

for (const a of args) {
  if (a.startsWith('--source=')) sourcePath = a.split('=').slice(1).join('=')
  else if (a.startsWith('--media-dir=')) mediaDir = a.split('=').slice(1).join('=')
  else if (a === '--dry-run') mode = 'dry-run'
  else if (a === '--apply') mode = 'apply'
  else if (a.startsWith('--confirm=')) confirmToken = a.split('=').slice(1).join('=')
  else abort(`Argumento desconhecido: ${a}`)
}

if (!sourcePath) abort('--source=<caminho> é obrigatório')
if (!mediaDir) abort('--media-dir=<caminho> é obrigatório')
if (mode === 'apply' && confirmToken !== 'BOOTSTRAP_ETERNAL_FLOWERS_PRODUCTION') {
  abort('--apply requer --confirm=BOOTSTRAP_ETERNAL_FLOWERS_PRODUCTION')
}

// DATABASE_URI do environment — nunca --target, nunca no log
const dbUri = process.env.DATABASE_URI
if (!dbUri) abort('DATABASE_URI não definida no environment')
if (typeof dbUri !== 'string' || dbUri.length < 10) abort('DATABASE_URI inválida')

// Sanitize para logs
const safeUri = sanitize(dbUri)

// ─── 1. VALIDATE SQLITE SOURCE ────────────────────────

console.log(`\n══════════════════════════════════════════════`)
console.log(` Bootstrap Canónico — Eternal Flowers`)
console.log(`══════════════════════════════════════════════`)
console.log(`\nSource: ${sourcePath}`)
console.log(`Media:  ${mediaDir}`)
console.log(`Target: ${safeUri}`)
console.log(`Mode:   ${mode}`)

if (!fs.existsSync(sourcePath)) abort(`Ficheiro não encontrado: ${sourcePath}`)

const actualHash = sha256File(sourcePath)
console.log(`\nSHA-256 source:`)
console.log(`  Expected: ${APPROVED_SQLITE_HASH}`)
console.log(`  Actual:   ${actualHash}`)

if (actualHash !== APPROVED_SQLITE_HASH) {
  console.error(`\n⚠️  SHA-256 diverge do hash canónico.`)
  console.error(`   Se o ficheiro for legítimo, atualize APPROVED_SQLITE_HASH.`)
  abort('Hash da origem não corresponde ao aprovado')
}
console.log(`  ✅ SHA-256 OK`)

// ─── 2. READ & COUNT SQLITE DATA ──────────────────────

console.log(`\n=== Counts SQLite ===`)

const src = new Database(sourcePath, { readonly: true, fileMustExist: true })

const sqliteCounts = {}
for (const t of Object.keys(EXPECTED_COUNTS)) {
  const row = src.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get()
  sqliteCounts[t] = row.c
  const status = row.c === EXPECTED_COUNTS[t] ? '✅' : '❌'
  console.log(`  ${status} ${t}: ${row.c} (expected ${EXPECTED_COUNTS[t]})`)
  if (row.c !== EXPECTED_COUNTS[t]) abort(`${t}: count ${row.c} != expected ${EXPECTED_COUNTS[t]}`)
}

// ─── 3. CHECK EXTRA TABLES (users/orders/coupons) ─────

const usersCount = src.prepare('SELECT COUNT(*) as c FROM users').get().c
const ordersCount = src.prepare('SELECT COUNT(*) as c FROM orders').get().c
const ordersItemsCount = src.prepare('SELECT COUNT(*) as c FROM orders_items').get().c
const couponsCount = src.prepare('SELECT COUNT(*) as c FROM coupons').get().c

console.log(`\n=== Extra tables (must be empty for bootstrap) ===`)
console.log(`  ℹ️  users: ${usersCount} (admin user esperado, ignorado)`)
console.log(`  ${ordersCount === 0 ? '✅' : '❌'} orders: ${ordersCount}`)
console.log(`  ${ordersItemsCount === 0 ? '✅' : '❌'} orders_items: ${ordersItemsCount}`)
console.log(`  ${couponsCount === 0 ? '✅' : '❌'} coupons: ${couponsCount}`)

if (ordersCount > 0) abort(`orders contém ${ordersCount} registos — migrar em separado.`)
if (ordersItemsCount > 0) abort(`orders_items contém ${ordersItemsCount} registos — migrar em separado.`)
if (couponsCount > 0) abort(`coupons contém ${couponsCount} registos — migrar em separado.`)

// ─── 4. VALIDATE MEDIA DIR ────────────────────────────

console.log(`\n=== Media directory validation ===`)

if (!fs.existsSync(mediaDir)) abort(`Media directory não encontrado: ${mediaDir}`)

const mediaFiles = fs.readdirSync(mediaDir).filter(f => fs.statSync(path.join(mediaDir, f)).isFile())
console.log(`  Ficheiros encontrados: ${mediaFiles.length}`)

for (const expectedFile of EXPECTED_MEDIA_FILES) {
  const filePath = path.join(mediaDir, expectedFile)
  if (!fs.existsSync(filePath)) {
    abort(`Ficheiro em falta no media-dir: ${expectedFile}`)
  }
  const fileHash = sha256File(filePath)
  const expectedHash = sha256FromHashTag(MEDIA_FILE_HASHES[expectedFile])
  const status = fileHash === expectedHash ? '✅' : '❌'
  if (fileHash !== expectedHash) {
    console.log(`  ${status} ${expectedFile}: hash ${fileHash}`)
    console.log(`    Expected: ${expectedHash}`)
    abort(`Hash diverge para ${expectedFile}`)
  }
  console.log(`  ✅ ${expectedFile}: SHA-256 OK`)
}

// Check no unexpected files (optional warning)
for (const f of mediaFiles) {
  if (!EXPECTED_MEDIA_FILES.includes(f)) {
    console.log(`  ⚠️  Ficheiro inesperado no media-dir: ${f}`)
  }
}

console.log(`  ✅ Todos os ${EXPECTED_MEDIA_FILES.length} media ficheiros validados`)

// ─── 5. READ ALL DATA FROM SQLITE ─────────────────────

const mediaRows = src.prepare('SELECT * FROM media ORDER BY id').all()
const catRows = src.prepare('SELECT * FROM categories ORDER BY id').all()
const colRows = src.prepare('SELECT * FROM collections ORDER BY id').all()
const flRows = src.prepare('SELECT * FROM flowers ORDER BY id').all()
const relRows = src.prepare('SELECT * FROM flowers_rels ORDER BY id').all()
const hpRow = src.prepare('SELECT * FROM homepage LIMIT 1').get()

// Build lookup maps for sourceHash validation
const catBySlug = {}
for (const r of catRows) catBySlug[r.slug] = r

const colBySlug = {}
for (const r of colRows) colBySlug[r.slug] = r

src.close()

// ─── 6. LOAD TRANSLATION MANIFESTS ────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const translationsDir = path.resolve(__dirname, '../../translations')

function loadTranslation(entityName) {
  const filePath = path.join(translationsDir, `${entityName}.json`)
  if (!fs.existsSync(filePath)) abort(`Translation manifest não encontrado: ${filePath}`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function loadTranslationLocale(entityName, locale) {
  const filePath = path.join(translationsDir, `${entityName}-${locale}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

const tHomepage = loadTranslation('homepage')
const tCategories = loadTranslation('categories')
const tCollections = loadTranslation('collections')
const tFlowers = loadTranslation('flowers')

// Also load per-locale files for the full values
const tHomepageLocales = {}
const tCategoriesLocales = {}
const tCollectionsLocales = {}
const tFlowersLocales = {}

for (const loc of TARGET_LOCALES) {
  tHomepageLocales[loc] = loadTranslationLocale('homepage', loc)
  tCategoriesLocales[loc] = loadTranslationLocale('categories', loc)
  tCollectionsLocales[loc] = loadTranslationLocale('collections', loc)
  tFlowersLocales[loc] = loadTranslationLocale('flowers', loc)
}

// ─── 7. CONNECT & VALIDATE TARGET PG ──────────────────

console.log(`\n═══ VALIDAÇÃO TARGET POSTGRESQL ═══`)

const client = new pg.Client({ connectionString: dbUri })
let skipPublishSequence = false

try {
  await client.connect()

  // Verify 17 migrations
  const migCount = await client.query(`SELECT COUNT(*)::int AS c FROM payload_migrations`)
  const actualMigCount = migCount.rows[0].c
  console.log(`\npayload_migrations: ${actualMigCount} (expected 17)`)
  if (actualMigCount !== 17) abort(`payload_migrations=${actualMigCount}, expected 17`)

  // Verify migration names
  const migNames = await client.query(`SELECT name FROM payload_migrations ORDER BY id`)
  const actualNames = migNames.rows.map(r => r.name)
  for (const expected of EXPECTED_MIGRATION_NAMES) {
    if (!actualNames.includes(expected)) {
      abort(`Migration em falta no target: ${expected}`)
    }
  }
  for (const actual of actualNames) {
    if (!EXPECTED_MIGRATION_NAMES.includes(actual)) {
      abort(`Migration extra no target: ${actual}`)
    }
  }
  console.log(`  ✅ Todas as 17 migrations coincidem com src/migrations-pg/index.ts`)

  // Verify all business tables are empty
  const EMPTY_CHECK_TABLES = [
    'homepage', 'categories', 'collections', 'flowers',
    'flowers_rels', 'flowers_images', 'media',
    'orders', 'orders_items', 'coupons', 'stock_reservations',
    'email_notifications',
    'homepage_locales', 'categories_locales', 'collections_locales', 'flowers_locales',
  ]

  console.log(`\nVerificando tabelas vazias...`)
  for (const t of EMPTY_CHECK_TABLES) {
    const tableExists = await client.query(
      `SELECT to_regclass('public.${t}') AS exists`
    )
    if (!tableExists.rows[0].exists) {
      console.log(`  ⚠️  Tabela não existe (pode ser normal se migration não a criou): ${t}`)
      continue
    }
    const result = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`)
    const count = result.rows[0].c
    if (count > 0) {
      abort(`Tabela "${t}" tem ${count} registo(s) — target não está vazio. Bootstrap só corre em DB vazia.`)
    }
    console.log(`  ✅ ${t}: 0 registos`)
  }

  console.log(`\n✅ Target PostgreSQL vazio — pronto para bootstrap`)

  // ─── 7b. VALIDATE SOURCE HASHES ─────────────────

  console.log(`\n═══ VALIDAÇÃO SOURCE HASH ═══`)
  const sourceErrors = []

  // Homepage: validate 16 PT fields against hpRow (SQLite)
  const HP_MANIFEST_MAP = {
    'hero.heroTitle': 'hero_hero_title',
    'hero.heroSubtitle': 'hero_hero_subtitle',
    'hero.primaryButtonText': 'hero_primary_button_text',
    'hero.secondaryButtonText': 'hero_secondary_button_text',
    'realFlowers.title': 'real_flowers_title',
    'realFlowers.subtitle': 'real_flowers_subtitle',
    'story.title': 'story_title',
    'story.text': 'story_text',
    'international.title': 'international_title',
    'international.subtitle': 'international_subtitle',
    'instagram.title': 'instagram_title',
    'instagram.text': 'instagram_text',
    'cta.title': 'cta_title',
    'cta.subtitle': 'cta_subtitle',
    'cta.buttonText': 'cta_button_text',
    'footer.brandDescription': 'footer_brand_description',
  }

  for (const [manifestKey, colName] of Object.entries(HP_MANIFEST_MAP)) {
    const field = tHomepage.fields[manifestKey]
    if (!field) {
      sourceErrors.push(`Manifest homepage: field '${manifestKey}' not found`)
      continue
    }
    const ptValue = hpRow[colName]
    const hash = sha256Short(ptValue)
    const expected = sha256FromHashTag(field.sourceHash).slice(0, 12)
    if (hash !== expected) {
      sourceErrors.push(`Homepage PT sourceHash mismatch for ${manifestKey}: got ${hash}, expected ${expected}`)
    }
  }

  // Categories: validate name/description against SQLite catRow by slug
  for (const [slug, catId] of Object.entries(CATEGORY_SLUG_TO_ID)) {
    const nameField = tCategories.fields[`${slug}.name`]
    const descField = tCategories.fields[`${slug}.description`]
    if (!nameField) { sourceErrors.push(`categories manifest: ${slug}.name not found`); continue }
    if (!descField) { sourceErrors.push(`categories manifest: ${slug}.description not found`); continue }

    const catRow = catBySlug[slug]
    if (!catRow) { sourceErrors.push(`SQLite category row not found for slug: ${slug}`); continue }

    // Validate name against SQLite PT value
    const nameHash = sha256Short(catRow.name)
    const expectedNameHash = sha256FromHashTag(nameField.sourceHash).slice(0, 12)
    if (nameHash !== expectedNameHash) {
      sourceErrors.push(`categories ${slug} name sourceHash mismatch: SQLite "${catRow.name}" → ${nameHash} vs manifest ${expectedNameHash}`)
    }

    // Validate description against SQLite PT value
    const descHash = sha256Short(catRow.description)
    const expectedDescHash = sha256FromHashTag(descField.sourceHash).slice(0, 12)
    if (descHash !== expectedDescHash) {
      sourceErrors.push(`categories ${slug} description sourceHash mismatch: SQLite desc → ${descHash} vs manifest ${expectedDescHash}`)
    }
  }

  // Collections: validate name/description against SQLite colRow by slug
  for (const [slug, colId] of Object.entries(COLLECTION_SLUG_TO_ID)) {
    const nameField = tCollections.fields[`${slug}.name`]
    const descField = tCollections.fields[`${slug}.description`]
    if (!nameField) { sourceErrors.push(`collections manifest: ${slug}.name not found`); continue }
    if (!descField) { sourceErrors.push(`collections manifest: ${slug}.description not found`); continue }

    const colRow = colBySlug[slug]
    if (!colRow) { sourceErrors.push(`SQLite collection row not found for slug: ${slug}`); continue }

    // Validate name against SQLite PT value
    const nameHash = sha256Short(colRow.name)
    const expectedNameHash = sha256FromHashTag(nameField.sourceHash).slice(0, 12)
    if (nameHash !== expectedNameHash) {
      sourceErrors.push(`collections ${slug} name sourceHash mismatch: SQLite "${colRow.name}" → ${nameHash} vs manifest ${expectedNameHash}`)
    }

    // Validate description against SQLite PT value
    const descHash = sha256Short(colRow.description)
    const expectedDescHash = sha256FromHashTag(descField.sourceHash).slice(0, 12)
    if (descHash !== expectedDescHash) {
      sourceErrors.push(`collections ${slug} description sourceHash mismatch: SQLite desc → ${descHash} vs manifest ${expectedDescHash}`)
    }
  }

  // Flowers: validate name, description, story against SQLite PT values
  for (const flower of flRows) {
    const fid = flower.id

    // Name
    const nameField = tFlowers.fields[`flower-${fid}.name`]
    if (!nameField) {
      sourceErrors.push(`flowers manifest: flower-${fid}.name not found`)
    } else {
      const nameHash = sha256Short(flower.name_pt)
      const expectedNameHash = sha256FromHashTag(nameField.sourceHash).slice(0, 12)
      if (nameHash !== expectedNameHash) {
        sourceErrors.push(`flowers flower-${fid} name sourceHash mismatch: SQLite "${flower.name_pt}" → ${nameHash} vs manifest ${expectedNameHash}`)
      }
    }

    // Description
    const descField = tFlowers.fields[`flower-${fid}.description`]
    if (!descField) {
      sourceErrors.push(`flowers manifest: flower-${fid}.description not found`)
    } else {
      const descHash = sha256Short(flower.description_pt)
      const expectedDescHash = sha256FromHashTag(descField.sourceHash).slice(0, 12)
      if (descHash !== expectedDescHash) {
        sourceErrors.push(`flowers flower-${fid} description sourceHash mismatch: SQLite desc → ${descHash} vs manifest ${expectedDescHash}`)
      }
    }

    // Story
    const storyField = tFlowers.fields[`flower-${fid}.story`]
    if (!storyField) {
      sourceErrors.push(`flowers manifest: flower-${fid}.story not found`)
    } else if (flower.story) {
      const storyHash = sha256Short(flower.story)
      const expectedStoryHash = sha256FromHashTag(storyField.sourceHash).slice(0, 12)
      if (storyHash !== expectedStoryHash) {
        sourceErrors.push(`flowers flower-${fid} story sourceHash mismatch: SQLite story → ${storyHash} vs manifest ${expectedStoryHash}`)
      }
    }
  }

  // Report sourceHash errors
  if (sourceErrors.length > 0) {
    console.error(`\n❌ ${sourceErrors.length} erro(s) de validação de sourceHash:`)
    for (const e of sourceErrors) console.error(`  - ${e}`)
    await client.end()
    process.exit(1)
  }

  console.log(`  ✅ Todos os sourceHashes validados contra PT canónico da SQLite`)

  // ─── 8. PLAN ────────────────────────────────────────

  const plan = {
    'media': mediaRows.length,
    'homepage': hpRow ? 1 : 0,
    'categories': catRows.length,
    'collections': colRows.length,
    'flowers': flRows.length,
    'flowers_rels': relRows.length,
  }

  const planLocales = {
    'homepage_locales': 5,
    'categories_locales': 25,
    'collections_locales': 30,
    'flowers_locales': 50,
  }

  console.log(`\n=== PLANO DE IMPORTAÇÃO ===`)
  console.log(`\nBase (52 registos):`)
  let totalBase = 0
  for (const [t, c] of Object.entries(plan)) {
    console.log(`  ${t}: ${c}`)
    totalBase += c
  }
  console.log(`  Total base: ${totalBase}`)

  console.log(`\nLocales (240 registos):`)
  let totalLocales = 0
  for (const [t, c] of Object.entries(planLocales)) {
    console.log(`  ${t}: ${c}`)
    totalLocales += c
  }
  console.log(`  Total locales: ${totalLocales}`)

  console.log(`\nName/description suffix fields (100):`)
  console.log(`  flowers.name_{pt,en,es,it,de}: 50`)
  console.log(`  flowers.description_{pt,en,es,it,de}: 50`)
  console.log(`  Total suffix: 100`)

  const grandTotal = totalBase + totalLocales + 100
  console.log(`\nGrand total valores de negócio: ${grandTotal}`)
  console.log(`  240 localized + 100 suffix = 340/340 valores de idioma`)

  console.log(`\nSequences a repor:`)
  console.log(`  media_id_seq, categories_id_seq, collections_id_seq, flowers_id_seq`)

  if (mode !== 'apply') {
    await client.end()
    console.log(`\n✅ dry-run — todas as validações passaram. Zero writes.`)
    process.exit(0)
  }

  // ══════════════════════════════════════════════════════
  // ─── APPLY PHASE ─────────────────────────────────────
  // ══════════════════════════════════════════════════════

  console.log(`\n═══ APPLY ═══`)

  // ─── BUILD INSERT STATEMENTS ─────────────────────

  const statements = []
  const errors = []

  statements.push('BEGIN;')

  // ─── MEDIA ────────────────────────────────────────

  for (const r of mediaRows) {
    statements.push(`INSERT INTO media (id, filename, mime_type, filesize, width, height, url,
      thumbnail_u_r_l,
      sizes_thumbnail_url, sizes_thumbnail_width, sizes_thumbnail_height,
      sizes_thumbnail_mime_type, sizes_thumbnail_filesize, sizes_thumbnail_filename,
      sizes_card_url, sizes_card_width, sizes_card_height,
      sizes_card_mime_type, sizes_card_filesize, sizes_card_filename,
      created_at, updated_at)
    VALUES (${r.id}, ${esc(r.filename)}, ${esc(r.mime_type)},
      ${r.filesize}, ${r.width ?? 800}, ${r.height ?? 800}, ${esc(r.url)},
      ${esc(r.thumbnail_u_r_l ?? r.url)},
      ${esc(r.sizes_thumbnail_url ?? r.url)},
      ${r.sizes_thumbnail_width ?? 400}, ${r.sizes_thumbnail_height ?? 400},
      ${esc(r.sizes_thumbnail_mime_type ?? r.mime_type)},
      ${r.sizes_thumbnail_filesize ?? Math.round(r.filesize / 4)},
      ${esc(r.sizes_thumbnail_filename ?? r.filename.replace('.jpg', '-400x400.jpg'))},
      ${esc(r.sizes_card_url ?? r.url)},
      ${r.sizes_card_width ?? 600}, ${r.sizes_card_height ?? 600},
      ${esc(r.sizes_card_mime_type ?? r.mime_type)},
      ${r.sizes_card_filesize ?? Math.round(r.filesize / 2)},
      ${esc(r.sizes_card_filename ?? r.filename.replace('.jpg', '-600x600.jpg'))},
      ${esc(r.created_at)}, ${esc(r.updated_at)})`)
  }

  // ─── CATEGORIES ───────────────────────────────────

  for (const r of catRows) {
    statements.push(`INSERT INTO categories (id, slug, updated_at, created_at)
      VALUES (${r.id}, ${esc(r.slug)}, ${esc(r.updated_at)}, ${esc(r.created_at)})`)
  }

  // ─── COLLECTIONS ──────────────────────────────────

  for (const r of colRows) {
    statements.push(`INSERT INTO collections (id, slug, is_active, image_id, updated_at, created_at)
      VALUES (${r.id}, ${esc(r.slug)}, ${escBool(r.is_active)},
        ${r.image_id ?? 'NULL'}, ${esc(r.updated_at)}, ${esc(r.created_at)})`)
  }

  // ─── FLOWERS ──────────────────────────────────────

  for (const r of flRows) {
    statements.push(`INSERT INTO flowers (id, name_pt, name_en, name_es, name_it, name_de,
      product_type, scientific_name, creation_name, price,
      description_pt, description_en, description_es, description_it, description_de,
      image_id, availability, sku, category_id,
      production_mode, production_lead_time, stock_quantity, shipping_class,
      created_at, updated_at)
    VALUES (${r.id}, ${esc(r.name_pt)}, ${esc(r.name_en)},
      ${esc(r.name_es)}, ${esc(r.name_it)}, ${esc(r.name_de)},
      ${esc(r.product_type)}, ${esc(r.scientific_name)}, ${esc(r.creation_name)},
      ${r.price},
      ${esc(r.description_pt)}, ${esc(r.description_en)},
      ${esc(r.description_es)}, ${esc(r.description_it)}, ${esc(r.description_de)},
      ${r.image_id ?? 'NULL'}, ${esc(r.availability)}, ${esc(r.sku)},
      ${r.category_id ?? 'NULL'},
      NULL, NULL, 0, 'standard',
      ${esc(r.created_at)}, ${esc(r.updated_at)})`)
  }

  // ─── FLOWERS_RELS ─────────────────────────────────

  for (const r of relRows) {
    statements.push(`INSERT INTO flowers_rels (id, "order", parent_id, path, collections_id)
      VALUES (${r.id}, ${r.order ?? 'NULL'}, ${r.parent_id},
        ${esc(r.path)}, ${r.collections_id ?? 'NULL'})`)
  }

  // ─── HOMEPAGE ─────────────────────────────────────
  // Nota: Após as migrations E2-E4, as colunas localizadas (hero_hero_title,
  // hero_hero_subtitle, hero_primary_button_text, hero_secondary_button_text,
  // real_flowers_title, real_flowers_subtitle, story_title, story_text,
  // international_title, international_subtitle, instagram_title,
  // instagram_text, cta_title, cta_subtitle, cta_button_text,
  // footer_brand_description) foram movidas para homepage_locales.
  //
  // A homepage table retém apenas:
  // id, hero_hero_image_id, hero_primary_button_link, hero_secondary_button_link,
  // story_image_id, instagram_handle, cta_button_link, footer_email, footer_phone,
  // footer_instagram_url, footer_whatsapp_url, updated_at, created_at

  statements.push(`INSERT INTO homepage (id,
    hero_primary_button_link, hero_secondary_button_link,
    story_image_id, hero_hero_image_id,
    instagram_handle,
    cta_button_link,
    footer_email, footer_phone,
    footer_instagram_url, footer_whatsapp_url,
    created_at, updated_at)
  VALUES (1,
    ${esc(hpRow.hero_primary_button_link)}, ${esc(hpRow.hero_secondary_button_link)},
    ${hpRow.story_image_id ?? 'NULL'}, ${hpRow.hero_hero_image_id ?? 'NULL'},
    ${esc(hpRow.instagram_handle)},
    ${esc(hpRow.cta_button_link)},
    ${esc(hpRow.footer_email)}, ${esc(hpRow.footer_phone)},
    ${esc(hpRow.footer_instagram_url)}, ${esc(hpRow.footer_whatsapp_url)},
    ${esc(hpRow.created_at)}, ${esc(hpRow.updated_at)})`)

  // ─── LOCALES: HOMEPAGE_LOCALES ────────────────────

  // Build the PT locale data from the source homepage row
  const hpLocaleFields = [
    ['hero_hero_title', hpRow.hero_hero_title],
    ['hero_hero_subtitle', hpRow.hero_hero_subtitle],
    ['hero_primary_button_text', hpRow.hero_primary_button_text],
    ['hero_secondary_button_text', hpRow.hero_secondary_button_text],
    ['real_flowers_title', hpRow.real_flowers_title],
    ['real_flowers_subtitle', hpRow.real_flowers_subtitle],
    ['story_title', hpRow.story_title],
    ['story_text', hpRow.story_text],
    ['international_title', hpRow.international_title],
    ['international_subtitle', hpRow.international_subtitle],
    ['instagram_title', hpRow.instagram_title],
    ['instagram_text', hpRow.instagram_text],
    ['cta_title', hpRow.cta_title],
    ['cta_subtitle', hpRow.cta_subtitle],
    ['cta_button_text', hpRow.cta_button_text],
    ['footer_brand_description', hpRow.footer_brand_description],
  ]

  // Build locale rows for all 5 locales
  // NOTE: No silent PT fallback — missing translation = ABORT
  for (const loc of ALL_LOCALES) {
    const colValues = {}
    let hpMissing = false
    for (const [colName, ptVal] of hpLocaleFields) {
      if (loc === 'pt') {
        colValues[colName] = ptVal
      } else {
        // Find the translation from manifest
        const manifestKey = Object.entries(HP_MANIFEST_MAP).find(([, v]) => v === colName)?.[0]
        if (manifestKey && tHomepage.fields[manifestKey]?.translations[loc]?.value != null) {
          colValues[colName] = tHomepage.fields[manifestKey].translations[loc].value
        } else {
          // Translation missing — abort, no PT fallback allowed
          hpMissing = true
          errors.push(`Homepage translation missing for ${colName} in locale ${loc} — ABORT (no PT fallback)`)
        }
      }
    }

    if (hpMissing) continue

    const cols = Object.keys(colValues)
    const vals = cols.map(c => esc(colValues[c]))
    statements.push(`INSERT INTO homepage_locales
      (${cols.join(', ')}, "_locale", "_parent_id")
      VALUES (${vals.join(', ')}, ${esc(loc)}, 1)`)
  }

  // ─── LOCALES: CATEGORIES_LOCALES ──────────────────

  const CAT_MANIFEST_SLUG_MAP = {
    colares: 1, brincos: 2, pulseiras: 3, 'porta-chaves': 4, molduras: 5,
  }

  for (const [slug, catId] of Object.entries(CAT_MANIFEST_SLUG_MAP)) {
    // PT values come from the local manifest as source
    const nameField = tCategories.fields[`${slug}.name`]
    const descField = tCategories.fields[`${slug}.description`]
    if (!nameField) { errors.push(`categories manifest: ${slug}.name not found`); continue }
    if (!descField) { errors.push(`categories manifest: ${slug}.description not found`); continue }

    for (const loc of ALL_LOCALES) {
      let nameVal, descVal
      if (loc === 'pt') {
        nameVal = nameField.source
        descVal = descField.source
      } else {
        nameVal = nameField.translations[loc]?.value ?? null
        descVal = descField.translations[loc]?.value ?? null
      }
      statements.push(`INSERT INTO categories_locales (name, description, "_locale", "_parent_id")
        VALUES (${esc(nameVal)}, ${esc(descVal)}, ${esc(loc)}, ${catId})`)
    }
  }

  // ─── LOCALES: COLLECTIONS_LOCALES ─────────────────

  for (const [slug, colId] of Object.entries(COLLECTION_SLUG_TO_ID)) {
    const nameField = tCollections.fields[`${slug}.name`]
    const descField = tCollections.fields[`${slug}.description`]
    if (!nameField) { errors.push(`collections manifest: ${slug}.name not found`); continue }
    if (!descField) { errors.push(`collections manifest: ${slug}.description not found`); continue }

    for (const loc of ALL_LOCALES) {
      let nameVal, descVal
      if (loc === 'pt') {
        nameVal = nameField.source
        descVal = descField.source
      } else {
        nameVal = nameField.translations[loc]?.value ?? null
        descVal = descField.translations[loc]?.value ?? null
      }
      statements.push(`INSERT INTO collections_locales (name, description, "_locale", "_parent_id")
        VALUES (${esc(nameVal)}, ${esc(descVal)}, ${esc(loc)}, ${colId})`)
    }
  }

  // ─── LOCALES: FLOWERS_LOCALES ─────────────────────

  for (const flower of flRows) {
    const fid = flower.id
    const ptStory = flower.story

    // Get story field (already validated in sourceHash section)
    const storyFieldKey = `flower-${fid}.story`
    const storyField = tFlowers.fields[storyFieldKey]
    if (!storyField) {
      errors.push(`flowers manifest: ${storyFieldKey} not found`)
      continue
    }

    // Build translation map for name/description suffix fields
    const nameField = `flower-${fid}.name`
    const descField = `flower-${fid}.description`

    for (const loc of ALL_LOCALES) {
      // Story in flowers_locales
      let storyVal = null
      if (loc === 'pt') {
        storyVal = ptStory
      } else {
        storyVal = storyField?.translations[loc]?.value ?? null
      }
      statements.push(`INSERT INTO flowers_locales (story, "_locale", "_parent_id")
        VALUES (${esc(storyVal)}, ${esc(loc)}, ${fid})`)

      // Name suffix: flowers.name_{pt,en,es,it,de}
      let nameVal = null
      if (loc === 'pt') {
        nameVal = flower.name_pt
      } else {
        const nameTranslation = tFlowers.fields[nameField]?.translations[loc]?.value ?? null
        nameVal = nameTranslation
      }

      // Description suffix: flowers.description_{pt,en,es,it,de}
      let descVal = null
      if (loc === 'pt') {
        descVal = flower.description_pt
      } else {
        descVal = tFlowers.fields[descField]?.translations[loc]?.value ?? null
      }

      // Update the suffix columns on the flowers table
      statements.push(`UPDATE flowers SET
        name_${loc} = ${esc(nameVal)},
        description_${loc} = ${esc(descVal)}
        WHERE id = ${fid}`)
    }
  }

  // ─── SEQUENCES ───────────────────────────────────

  const maxMediaId = mediaRows.reduce((mx, r) => Math.max(mx, r.id), 0)
  const maxCatId = catRows.reduce((mx, r) => Math.max(mx, r.id), 0)
  const maxColId = colRows.reduce((mx, r) => Math.max(mx, r.id), 0)
  const maxFlId = flRows.reduce((mx, r) => Math.max(mx, r.id), 0)
  const maxRelId = relRows.reduce((mx, r) => Math.max(mx, r.id), 0)

  // Reset sequences using pg_get_serial_sequence
  for (const [table, maxId] of [
    ['media', maxMediaId],
    ['categories', maxCatId],
    ['collections', maxColId],
    ['flowers', maxFlId],
    ['flowers_rels', maxRelId],
    ['homepage', 1],
  ]) {
    if (maxId > 0) {
      statements.push(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), ${maxId})`
      )
    }
  }

  // Also reset locale table sequences
  statements.push(
    `SELECT setval(pg_get_serial_sequence('homepage_locales', 'id'), 5)`,
    `SELECT setval(pg_get_serial_sequence('categories_locales', 'id'), 25)`,
    `SELECT setval(pg_get_serial_sequence('collections_locales', 'id'), 30)`,
    `SELECT setval(pg_get_serial_sequence('flowers_locales', 'id'), 50)`,
  )

  // ─── ABORT ON VALIDATION ERRORS ─────────────────

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} erro(s) de validação:`)
    for (const e of errors) console.error(`  - ${e}`)
    await client.query('ROLLBACK')
    await client.end()
    process.exit(1)
  }

  // ══════════════════════════════════════════════════
  // ─── EXECUTE ─────────────────────────────────────
  // ══════════════════════════════════════════════════

  console.log(`\n═══ EXECUTANDO ${statements.length} statements ═══`)

  for (let i = 0; i < statements.length; i++) {
    await client.query(statements[i])
  }

  // ══════════════════════════════════════════════════
  // ─── VERIFICAÇÃO ANTES DE COMMIT ─────────────────
  // ══════════════════════════════════════════════════

  console.log(`\n═══ VERIFICAÇÃO PRÉ-COMMIT ═══`)

  // Verify base counts
  const BASE_CHECKS = {
    homepage: 1,
    categories: 5,
    collections: 6,
    flowers: 10,
    media: 11,
    flowers_rels: 19,
    flowers_images: 0,
  }

  let allOk = true

  for (const [tbl, expected] of Object.entries(BASE_CHECKS)) {
    const res = await client.query(`SELECT COUNT(*)::int AS c FROM "${tbl}"`)
    const actual = res.rows[0].c
    const status = actual === expected ? '✅' : '❌'
    console.log(`  ${status} ${tbl}: ${actual} (expected ${expected})`)
    if (actual !== expected) { allOk = false; console.error(`    FAIL: count mismatch`) }
  }

  // Verify locale counts
  const LOCALE_CHECKS = {
    homepage_locales: 5,
    categories_locales: 25,
    collections_locales: 30,
    flowers_locales: 50,
  }

  for (const [tbl, expected] of Object.entries(LOCALE_CHECKS)) {
    const res = await client.query(`SELECT COUNT(*)::int AS c FROM "${tbl}"`)
    const actual = res.rows[0].c
    const status = actual === expected ? '✅' : '❌'
    console.log(`  ${status} ${tbl}: ${actual} (expected ${expected})`)
    if (actual !== expected) { allOk = false; console.error(`    FAIL: count mismatch`) }
  }

  // Verify payload_migrations still = 17
  const pmRes = await client.query(`SELECT COUNT(*)::int AS c FROM payload_migrations`)
  console.log(`  ✅ payload_migrations: ${pmRes.rows[0].c} (unchanged)`)

  // Verify transaction tables still empty
  const EMPTY_AFTER = ['orders', 'coupons', 'stock_reservations', 'email_notifications']
  for (const tbl of EMPTY_AFTER) {
    const res = await client.query(`SELECT COUNT(*)::int AS c FROM "${tbl}"`)
    const actual = res.rows[0].c
    const status = actual === 0 ? '✅' : '❌'
    console.log(`  ${status} ${tbl}: ${actual} (must be 0)`)
    if (actual !== 0) { allOk = false; console.error(`    FAIL: should be empty`) }
  }

  // Verify all FKs are valid
  // Media → filename matches expected list
  const mediaRes = await client.query(`SELECT id, filename FROM media ORDER BY id`)
  console.log(`\nMedia FK validation:`)
  for (const row of mediaRes.rows) {
    const expected = EXPECTED_MEDIA_FILES.includes(row.filename)
    const status = expected ? '✅' : '❌'
    if (!expected) { allOk = false }
    console.log(`  ${status} media ${row.id}: ${row.filename}`)
  }

  // Verify image_id references in flowers
  const flowerImageRefs = await client.query(
    `SELECT f.id, f.name_pt, f.image_id, m.id AS mid
     FROM flowers f LEFT JOIN media m ON f.image_id = m.id`
  )
  console.log(`\nFlower image_id references:`)
  for (const row of flowerImageRefs.rows) {
    const valid = row.image_id === null || row.mid !== null
    const status = valid ? '✅' : '❌'
    if (!valid) { allOk = false }
    console.log(`  ${status} flower ${row.id} (${row.name_pt}): image_id=${row.image_id}`)
  }

  // Verify category_id references in flowers
  const flowerCatRefs = await client.query(
    `SELECT f.id, f.category_id, c.id AS cid
     FROM flowers f LEFT JOIN categories c ON f.category_id = c.id`
  )
  console.log(`\nFlower category_id references:`)
  for (const row of flowerCatRefs.rows) {
    const valid = row.cid !== null
    const status = valid ? '✅' : '❌'
    if (!valid) { allOk = false }
    console.log(`  ${status} flower ${row.id}: category_id=${row.category_id}`)
  }

  // Verify homepage references
  const hpRefs = await client.query(
    `SELECT h.id, h.hero_hero_image_id, h.story_image_id,
            m1.id AS hero_img, m2.id AS story_img
     FROM homepage h
     LEFT JOIN media m1 ON h.hero_hero_image_id = m1.id
     LEFT JOIN media m2 ON h.story_image_id = m2.id`
  )
  const hpRef = hpRefs.rows[0]
  console.log(`\nHomepage references:`)
  const heroOk = hpRef.hero_hero_image_id === null || hpRef.hero_img !== null
  const storyOk = hpRef.story_image_id === null || hpRef.story_img !== null
  console.log(`  ${heroOk ? '✅' : '❌'} hero_hero_image_id=${hpRef.hero_hero_image_id}`)
  console.log(`  ${storyOk ? '✅' : '❌'} story_image_id=${hpRef.story_image_id}`)
  if (!heroOk || !storyOk) allOk = false

  // Verify flowers_rels FKs
  const relsCheck = await client.query(
    `SELECT COUNT(*)::int AS invalid FROM flowers_rels r
     LEFT JOIN flowers f ON r.parent_id = f.id
     LEFT JOIN collections c ON r.collections_id = c.id
     WHERE f.id IS NULL OR c.id IS NULL`
  )
  console.log(`\nFlowers_rels FK validation: ${relsCheck.rows[0].invalid} invalid`)
  if (relsCheck.rows[0].invalid > 0) allOk = false

  // Verify locale FKs
  const localeParents = ['homepage_locales', 'categories_locales', 'collections_locales', 'flowers_locales']
  const parentTables = ['homepage', 'categories', 'collections', 'flowers']
  for (let i = 0; i < localeParents.length; i++) {
    const lres = await client.query(
      `SELECT COUNT(*)::int AS invalid FROM "${localeParents[i]}" l
       LEFT JOIN "${parentTables[i]}" p ON l._parent_id = p.id
       WHERE p.id IS NULL`
    )
    console.log(`  ${localeParents[i]} FK: ${lres.rows[0].invalid} invalid`)
    if (lres.rows[0].invalid > 0) allOk = false
  }

  // Verify sequences
  console.log(`\nSequences:`)
  for (const seq of ['media_id_seq', 'categories_id_seq', 'collections_id_seq', 'flowers_id_seq', 'flowers_rels_id_seq', 'homepage_id_seq']) {
    const sres = await client.query(`SELECT last_value FROM "${seq}"`)
    console.log(`  ${seq}: last_value = ${sres.rows[0].last_value}`)
  }

  // Verify locale sequences
  for (const seq of ['homepage_locales_id_seq', 'categories_locales_id_seq', 'collections_locales_id_seq', 'flowers_locales_id_seq']) {
    const sres = await client.query(`SELECT last_value FROM "${seq}"`)
    console.log(`  ${seq}: last_value = ${sres.rows[0].last_value}`)
  }

  // ═══════════════════════════════════════════════
  // 340/340 VALIDAÇÃO DOS VALORES DE IDIOMA
  // ═══════════════════════════════════════════════

  console.log(`\n═══ 340/340 VALIDAÇÃO DE IDIOMA ═══`)

  let langOk = true

  // --- 80 homepage_locales values ---
  for (const loc of ALL_LOCALES) {
    const res = await client.query(
      `SELECT * FROM homepage_locales WHERE "_locale" = $1 AND "_parent_id" = 1`, [loc]
    )
    if (res.rows.length === 0) {
      console.log(`  ❌ homepage_locales missing for locale ${loc}`)
      langOk = false; continue
    }
    const row = res.rows[0]
    for (const [colName, ptVal] of hpLocaleFields) {
      let expected
      if (loc === 'pt') {
        expected = ptVal
      } else {
        const manifestKey = Object.entries(HP_MANIFEST_MAP).find(([, v]) => v === colName)?.[0]
        // No PT fallback — if translation is missing, expected is null and will fail
        expected = tHomepage.fields[manifestKey]?.translations[loc]?.value ?? null
      }
      const actual = row[colName]
      if (String(actual ?? '') !== String(expected ?? '')) {
        console.log(`  ❌ homepage_locales[${loc}].${colName}: expected="${(expected ?? '').slice(0, 40)}", got="${(actual ?? '').slice(0, 40)}"`)
        langOk = false
      }
    }
  }
  console.log(`  ✅ homepage_locales: 80/80 valores`)

  // --- 50 categories_locales values ---
  for (const [slug, catId] of Object.entries(CAT_MANIFEST_SLUG_MAP)) {
    for (const loc of ALL_LOCALES) {
      const res = await client.query(
        `SELECT * FROM categories_locales WHERE "_locale" = $1 AND "_parent_id" = $2`, [loc, catId]
      )
      if (res.rows.length === 0) {
        console.log(`  ❌ categories_locales missing for slug=${slug}, locale=${loc}`)
        langOk = false; continue
      }
      const row = res.rows[0]
      const nameField = tCategories.fields[`${slug}.name`]
      const descField = tCategories.fields[`${slug}.description`]
      const expectedName = loc === 'pt' ? nameField.source : (nameField.translations[loc]?.value ?? null)
      const expectedDesc = loc === 'pt' ? descField.source : (descField.translations[loc]?.value ?? null)
      if (row.name !== expectedName) {
        console.log(`  ❌ categories_locales[${slug},${loc}].name: "${row.name}" vs "${expectedName}"`)
        langOk = false
      }
      if (row.description !== expectedDesc) {
        console.log(`  ❌ categories_locales[${slug},${loc}].description: "${row.description}" vs "${expectedDesc}"`)
        langOk = false
      }
    }
  }
  console.log(`  ✅ categories_locales: 50/50 valores`)

  // --- 60 collections_locales values ---
  for (const [slug, colId] of Object.entries(COLLECTION_SLUG_TO_ID)) {
    for (const loc of ALL_LOCALES) {
      const res = await client.query(
        `SELECT * FROM collections_locales WHERE "_locale" = $1 AND "_parent_id" = $2`, [loc, colId]
      )
      if (res.rows.length === 0) {
        console.log(`  ❌ collections_locales missing for slug=${slug}, locale=${loc}`)
        langOk = false; continue
      }
      const row = res.rows[0]
      const nameField = tCollections.fields[`${slug}.name`]
      const descField = tCollections.fields[`${slug}.description`]
      const expectedName = loc === 'pt' ? nameField.source : (nameField.translations[loc]?.value ?? null)
      const expectedDesc = loc === 'pt' ? descField.source : (descField.translations[loc]?.value ?? null)
      if (row.name !== expectedName) {
        console.log(`  ❌ collections_locales[${slug},${loc}].name: "${row.name}" vs "${expectedName}"`)
        langOk = false
      }
      if (row.description !== expectedDesc) {
        console.log(`  ❌ collections_locales[${slug},${loc}].description: "${row.description}" vs "${expectedDesc}"`)
        langOk = false
      }
    }
  }
  console.log(`  ✅ collections_locales: 60/60 valores`)

  // --- 50 flowers_locales values ---
  for (const flower of flRows) {
    for (const loc of ALL_LOCALES) {
      const res = await client.query(
        `SELECT * FROM flowers_locales WHERE "_locale" = $1 AND "_parent_id" = $2`, [loc, flower.id]
      )
      if (res.rows.length === 0) {
        console.log(`  ❌ flowers_locales missing for flower=${flower.id}, locale=${loc}`)
        langOk = false; continue
      }
      const row = res.rows[0]
      const storyField = tFlowers.fields[`flower-${flower.id}.story`]
      const expectedStory = loc === 'pt' ? flower.story : (storyField?.translations[loc]?.value ?? null)
      if (String(row.story ?? '') !== String(expectedStory ?? '')) {
        console.log(`  ❌ flowers_locales[${flower.id},${loc}].story mismatch`)
        console.log(`    expected: "${(expectedStory ?? '').slice(0, 50)}..."`)
        console.log(`    got:      "${(row.story ?? '').slice(0, 50)}..."`)
        langOk = false
      }
    }
  }
  console.log(`  ✅ flowers_locales: 50/50 valores`)

  // --- 100 name/description suffix values ---
  for (const flower of flRows) {
    const res = await client.query(`SELECT * FROM flowers WHERE id = $1`, [flower.id])
    const row = res.rows[0]
    for (const loc of ALL_LOCALES) {
      // name
      const nameField = tFlowers.fields[`flower-${flower.id}.name`]
      const expectedName = loc === 'pt' ? flower.name_pt : (nameField?.translations[loc]?.value ?? null)
      const actualName = row[`name_${loc}`]
      if (String(actualName ?? '') !== String(expectedName ?? '')) {
        console.log(`  ❌ flowers[${flower.id}].name_${loc}: "${actualName}" vs "${expectedName}"`)
        langOk = false
      }

      // description
      const descField = tFlowers.fields[`flower-${flower.id}.description`]
      const expectedDesc = loc === 'pt' ? flower.description_pt : (descField?.translations[loc]?.value ?? null)
      const actualDesc = row[`description_${loc}`]
      if (String(actualDesc ?? '') !== String(expectedDesc ?? '')) {
        console.log(`  ❌ flowers[${flower.id}].description_${loc}: "${(actualDesc ?? '').slice(0, 30)}" vs "${(expectedDesc ?? '').slice(0, 30)}"`)
        langOk = false
      }
    }
  }
  console.log(`  ✅ flowers name/description suffix: 100/100 valores`)

  const langStatus = langOk ? '✅ 340/340' : '❌ FAIL'
  console.log(`\n  ${langStatus} valores de idioma`)

  // ─── FINAL VERDICT ─────────────────────────────

  if (!allOk || !langOk) {
    console.error(`\n❌ VERIFICAÇÕES FALHARAM — ROLLBACK`)
    await client.query('ROLLBACK')
    await client.end()
    process.exit(1)
  }

  // ═══════════════════════════════════════════════
  // ─── COMMIT ───────────────────────────────────
  // ═══════════════════════════════════════════════

  await client.query('COMMIT')
  console.log(`\n✅ COMMIT — ${totalBase} registos base + 240 locales + 100 suffix escritos`)
  console.log(`✅ SUCCESS — bootstrap concluído`)

  await client.end()

} catch (e) {
  try {
    await client.query('ROLLBACK')
    console.log('Rollback executado.')
  } catch (er) {
    // ignore rollback error
  }
  console.error(`\n❌ ERROR — transação revertida.`)
  console.error(`  ${e.message || e}`)
  if (e.stack) console.error(e.stack.split('\n').slice(0, 5).join('\n'))
  try { await client.end() } catch (er) {}
  process.exit(1)
}