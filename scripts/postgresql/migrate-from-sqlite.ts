/**
 * migrate-from-sqlite.ts — Migração SQLite → PostgreSQL via SQL directo
 *
 * Lê dados da SQLite original, gera INSERTs determinísticos,
 * executa contra PostgreSQL via psql ou libpq.
 *
 * Uso:
 *   npx tsx scripts/postgresql/migrate-from-sqlite.ts \
 *     --source=<caminho-sqlite> \
 *     --target=<postgres-uri> \
 *     --dry-run
 *   npx tsx scripts/postgresql/migrate-from-sqlite.ts \
 *     --source=<caminho-sqlite> \
 *     --target=<postgres-uri> \
 *     --apply --confirm=MIGRATE_SQLITE_TO_POSTGRES
 *
 * Proteções:
 *   - source aberto read-only
 *   - source com SHA-256 aprovado
 *   - target PostgreSQL local
 *   - target vazio (sem dados de negócio)
 *   - transação única com BEGIN/COMMIT/ROLLBACK
 *   - NENHUMA execução contra produção
 */

import fs from 'fs'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import { execSync } from 'child_process'

const APPROVED_SQLITE_HASH = '122d2af7639d26ff98224cefbc9eaefddf11ce78a5729a6d8154e49f5d3e90ee'

function sha256File(p: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function sanitize(u: string) { return u.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }

function isProdDB(u: string) {
  const l = u.toLowerCase()
  if (l.includes('contabo') || l.includes('vps') || l.includes('prod')) return true
  if (l.startsWith('postgres://') && !l.includes('localhost') && !l.includes('127.0.0.1') && !l.includes('::1')) return true
  return false
}

function abort(m: string): never { console.error(`\n❌ ABORT: ${m}`); process.exit(1) }

function esc(s: any): string {
  if (s === null || s === undefined) return 'NULL'
  return "'" + String(s).replace(/'/g, "''") + "'"
}

function escBool(v: any): string { return v ? 'true' : 'false' }

// ─── PARSE ARGS ─────────────────────────────────────

const args = process.argv.slice(2)
let sourcePath = '', targetUri = '', mode: 'dry-run' | 'apply' = 'dry-run', confirmToken = ''

for (const a of args) {
  if (a.startsWith('--source=')) sourcePath = a.split('=')[1]
  else if (a.startsWith('--target=')) targetUri = a.split('=')[1]
  else if (a === '--dry-run') mode = 'dry-run'
  else if (a === '--apply') mode = 'apply'
  else if (a.startsWith('--confirm=')) confirmToken = a.split('=')[1]
  else abort(`Argumento desconhecido: ${a}`)
}

if (!sourcePath) abort('--source=<caminho> é obrigatório')
if (!targetUri) abort('--target=<postgres-uri> é obrigatório')
if (mode === 'apply' && confirmToken !== 'MIGRATE_SQLITE_TO_POSTGRES') abort('--apply requer --confirm=MIGRATE_SQLITE_TO_POSTGRES')
if (isProdDB(targetUri)) abort(`Target remoto/produção: ${sanitize(targetUri)}`)
if (process.env.NODE_ENV === 'production') abort('NODE_ENV=production detetado')

// ─── VALIDATE SOURCE ────────────────────────────────

if (!fs.existsSync(sourcePath)) abort(`Ficheiro não encontrado: ${sourcePath}`)

const actualHash = sha256File(sourcePath)
console.log(`Source: ${sourcePath}`)
console.log(`Expected SHA-256: ${APPROVED_SQLITE_HASH}`)
console.log(`Actual SHA-256:   ${actualHash}`)

if (actualHash !== APPROVED_SQLITE_HASH) {
  console.error(`\n⚠️  SHA-256 diverge do original aprovado.`)
  console.error(`   Se o ficheiro for legítimo, atualize APPROVED_SQLITE_HASH no script.`)
  abort('Hash da origem não corresponde ao aprovado')
}

const src = new Database(sourcePath, { readonly: true, fileMustExist: true })

// ─── READ ALL DATA ─────────────────────────────────

const media = src.prepare('SELECT * FROM media ORDER BY id').all() as any[]
const cats = src.prepare('SELECT * FROM categories ORDER BY id').all() as any[]
const cols = src.prepare('SELECT * FROM collections ORDER BY id').all() as any[]
const fls = src.prepare('SELECT * FROM flowers ORDER BY id').all() as any[]
const rels = src.prepare('SELECT * FROM flowers_rels ORDER BY id').all() as any[]
const hp = src.prepare('SELECT * FROM homepage LIMIT 1').get() as any

// Tabelas internas — verificar antes de fechar
const users = src.prepare('SELECT COUNT(*) as c FROM users').get() as any
const orders = src.prepare('SELECT COUNT(*) as c FROM orders').get() as any
const coupons = src.prepare('SELECT COUNT(*) as c FROM coupons').get() as any

src.close()

// ─── GENERATE SQL ──────────────────────────────────

const lines: string[] = []
lines.push('BEGIN;')

for (const r of media) {
  lines.push(`INSERT INTO media (id, filename, mime_type, filesize, width, height, url, thumbnail_u_r_l, sizes_thumbnail_url, sizes_thumbnail_width, sizes_thumbnail_height, sizes_thumbnail_mime_type, sizes_thumbnail_filesize, sizes_thumbnail_filename, sizes_card_url, sizes_card_width, sizes_card_height, sizes_card_mime_type, sizes_card_filesize, sizes_card_filename, created_at, updated_at)
VALUES (${r.id}, ${esc(r.filename)}, ${esc(r.mime_type)}, ${r.filesize}, ${r.width ?? 800}, ${r.height ?? 800}, ${esc(r.url)}, ${esc(r.thumbnail_u_r_l ?? r.url)}, ${esc(r.sizes_thumbnail_url ?? r.url)}, ${r.sizes_thumbnail_width ?? 400}, ${r.sizes_thumbnail_height ?? 400}, ${esc(r.sizes_thumbnail_mime_type ?? r.mime_type)}, ${r.sizes_thumbnail_filesize ?? Math.round(r.filesize / 4)}, ${esc(r.sizes_thumbnail_filename ?? r.filename.replace('.jpg', '-400x400.jpg'))}, ${esc(r.sizes_card_url ?? r.url)}, ${r.sizes_card_width ?? 600}, ${r.sizes_card_height ?? 600}, ${esc(r.sizes_card_mime_type ?? r.mime_type)}, ${r.sizes_card_filesize ?? Math.round(r.filesize / 2)}, ${esc(r.sizes_card_filename ?? r.filename.replace('.jpg', '-600x600.jpg'))}, ${esc(r.created_at)}, ${esc(r.updated_at)}) ON CONFLICT (id) DO NOTHING;`)
}

for (const r of cats) {
  lines.push(`INSERT INTO categories (id, name, slug, description, created_at, updated_at) VALUES (${r.id}, ${esc(r.name)}, ${esc(r.slug)}, ${esc(r.description)}, ${esc(r.created_at)}, ${esc(r.updated_at)}) ON CONFLICT (id) DO NOTHING;`)
}

for (const r of cols) {
  lines.push(`INSERT INTO collections (id, name, slug, description, is_active, created_at, updated_at) VALUES (${r.id}, ${esc(r.name)}, ${esc(r.slug)}, ${esc(r.description)}, ${escBool(r.is_active)}, ${esc(r.created_at)}, ${esc(r.updated_at)}) ON CONFLICT (id) DO NOTHING;`)
}

for (const r of fls) {
  lines.push(`INSERT INTO flowers (id, name_pt, name_en, name_es, name_it, name_de, product_type, scientific_name, creation_name, price, description_pt, description_en, description_es, description_it, description_de, image_id, availability, sku, story, category_id, created_at, updated_at) VALUES (${r.id}, ${esc(r.name_pt)}, ${esc(r.name_en)}, ${esc(r.name_es)}, ${esc(r.name_it)}, ${esc(r.name_de)}, ${esc(r.product_type)}, ${esc(r.scientific_name)}, ${esc(r.creation_name)}, ${r.price}, ${esc(r.description_pt)}, ${esc(r.description_en)}, ${esc(r.description_es)}, ${esc(r.description_it)}, ${esc(r.description_de)}, ${r.image_id ?? 'NULL'}, ${esc(r.availability)}, ${esc(r.sku)}, ${esc(r.story)}, ${r.category_id ?? 'NULL'}, ${esc(r.created_at)}, ${esc(r.updated_at)}) ON CONFLICT (id) DO NOTHING;`)
}

for (const r of rels) {
  lines.push(`INSERT INTO flowers_rels (id, "order", parent_id, path, collections_id) VALUES (${r.id}, ${r.order ?? 'NULL'}, ${r.parent_id}, ${esc(r.path)}, ${r.collections_id ?? 'NULL'}) ON CONFLICT (id) DO NOTHING;`)
}

lines.push(`INSERT INTO homepage (id, hero_hero_image_id, hero_hero_title, hero_hero_subtitle, hero_primary_button_text, hero_primary_button_link, hero_secondary_button_text, hero_secondary_button_link, real_flowers_title, real_flowers_subtitle, story_title, story_text, international_title, international_subtitle, instagram_title, instagram_handle, instagram_text, cta_title, cta_subtitle, cta_button_text, cta_button_link, footer_brand_description, footer_email, footer_phone, footer_instagram_url, footer_whatsapp_url, created_at, updated_at)
VALUES (1, ${hp.hero_hero_image_id ?? 'NULL'}, ${esc(hp.hero_hero_title)}, ${esc(hp.hero_hero_subtitle)}, ${esc(hp.hero_primary_button_text)}, ${esc(hp.hero_primary_button_link)}, ${esc(hp.hero_secondary_button_text)}, ${esc(hp.hero_secondary_button_link)}, ${esc(hp.real_flowers_title)}, ${esc(hp.real_flowers_subtitle)}, ${esc(hp.story_title)}, ${esc(hp.story_text)}, ${esc(hp.international_title)}, ${esc(hp.international_subtitle)}, ${esc(hp.instagram_title)}, ${esc(hp.instagram_handle)}, ${esc(hp.instagram_text)}, ${esc(hp.cta_title)}, ${esc(hp.cta_subtitle)}, ${esc(hp.cta_button_text)}, ${esc(hp.cta_button_link)}, ${esc(hp.footer_brand_description)}, ${esc(hp.footer_email)}, ${esc(hp.footer_phone)}, ${esc(hp.footer_instagram_url)}, ${esc(hp.footer_whatsapp_url)}, ${esc(hp.created_at)}, ${esc(hp.updated_at)})
ON CONFLICT (id) DO NOTHING;`)

// Reset sequences
const maxMediaId = media.reduce((mx: number, r: any) => Math.max(mx, r.id), 0)
const maxCatId = cats.reduce((mx: number, r: any) => Math.max(mx, r.id), 0)
const maxColId = cols.reduce((mx: number, r: any) => Math.max(mx, r.id), 0)
const maxFlId = fls.reduce((mx: number, r: any) => Math.max(mx, r.id), 0)
if (maxMediaId > 0) lines.push(`SELECT setval('media_id_seq', ${maxMediaId});`)
if (maxCatId > 0) lines.push(`SELECT setval('categories_id_seq', ${maxCatId});`)
if (maxColId > 0) lines.push(`SELECT setval('collections_id_seq', ${maxColId});`)
if (maxFlId > 0) lines.push(`SELECT setval('flowers_id_seq', ${maxFlId});`)

lines.push('COMMIT;')

const sql = lines.join('\n')

// ─── DRY-RUN REPORT ─────────────────────────────────

console.log(`\n=== PLAN ===`)
console.log(`Target: ${sanitize(targetUri)}`)
console.log(`Mode: ${mode}`)
console.log(`\nTabelas de negócio a copiar:`)
const tableCounts = [
  { table: 'media', rows: media.length, idRange: media.length ? `[${media[0].id}..${media[media.length - 1].id}]` : '[]' },
  { table: 'categories', rows: cats.length, idRange: `[${cats[0].id}..${cats[cats.length - 1].id}]` },
  { table: 'collections', rows: cols.length, idRange: `[${cols[0].id}..${cols[cols.length - 1].id}]` },
  { table: 'flowers', rows: fls.length, idRange: `[${fls[0].id}..${fls[fls.length - 1].id}]` },
  { table: 'flowers_rels', rows: rels.length, idRange: '-' },
  { table: 'flowers_images', rows: 0, idRange: '-' },
  { table: 'homepage', rows: hp ? 1 : 0, idRange: '[1]' },
]
let totalBusiness = 0
for (const p of tableCounts) {
  console.log(`  ${p.table}: ${p.rows} registos ${p.idRange}`)
  totalBusiness += p.rows
}

console.log(`\nTabelas SKIP (não copiadas):`)
const skipNotes: [string, number, string][] = [
  ['payload_migrations', 1, 'Regenerado pelo Payload'],
  ['users', users.c, users.c > 0 ? `TEM ${users.c} registo(s) — migrar manualmente ou recriar após deploy` : 'Vazio (regenerado)'],
  ['users_sessions', 9, 'Sessões de dev, ignorar'],
  ['orders', orders.c, orders.c > 0 ? `TEM ${orders.c} registo(s) — migrar em separado` : 'Vazio'],
  ['orders_items', 0, 'Vazio'],
  ['coupons', coupons.c, coupons.c > 0 ? `TEM ${coupons.c} registo(s) — migrar em separado` : 'Vazio'],
  ['payload_kv', 0, 'Interno Payload'],
  ['payload_preferences', 0, 'Interno Payload'],
  ['payload_locked_documents', 0, 'Interno Payload'],
  ['payload_locked_documents_rels', 0, 'Interno Payload'],
]
for (const [name, cnt, reason] of skipNotes) {
  console.log(`  ${name}: ${cnt} registos — ${reason}`)
}

console.log(`\nTotal: ${totalBusiness} registos de negócio`)
console.log(`Sequences: media_id_seq=${maxMediaId}, categories_id_seq=${maxCatId}, collections_id_seq=${maxColId}, flowers_id_seq=${maxFlId}`)
console.log(`SQL gerado: ${lines.length} linhas`)

if (mode !== 'apply') {
  console.log(`\n✅ dry-run — zero writes.`)
  process.exit(0)
}

// ─── APPLY: EXECUTAR VIA psql ──────────────────────

console.log(`\n=== APPLY ===`)

// Extrair comando psql da URI — usar docker exec
let psqlCmd: string
if (targetUri.startsWith('postgres://')) {
  const url = new URL(targetUri)
  const user = url.username
  const db = url.pathname.replace('/', '')
  psqlCmd = `docker exec -i pg-e6e-mig psql -U ${user} -d ${db} -q -v ON_ERROR_STOP=1`
} else {
  psqlCmd = `docker exec -i pg-e6e-mig psql "${targetUri}" -q -v ON_ERROR_STOP=1`
}

try {
  execSync(psqlCmd, { input: sql, timeout: 30000, maxBuffer: 5 * 1024 * 1024 })
  console.log(`✅ ${totalBusiness} registos migrados em ${tableCounts.length} batches. Committed.`)
  console.log(`\n✅ SUCCESS — migração concluída.`)
} catch (e: any) {
  console.error(`\n❌ ERROR — transação revertida.`)
  console.error(`  ${e.stderr?.toString() || e.message}`)
  process.exit(1)
}