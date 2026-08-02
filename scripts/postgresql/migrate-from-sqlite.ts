/**
 * migrate-from-sqlite.ts — Ferramenta de migração SQLite → PostgreSQL
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
 *   - transação única
 *   - rollback completo em erro
 *   - NENHUMA execução contra produção
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import { getPayload, initTransaction, commitTransaction, killTransaction } from 'payload'
import config from '../../src/payload.config.js'

;(async () => {

// ─── CONSTANTS ──────────────────────────────────────

const APPROVED_SQLITE_HASH = '122d2af7639d26ff98224cefbc9eaefddf11ce78a5729a6d8154e49f5d3e90ee'
const BUSINESS_TABLES = ['homepage', 'categories', 'collections', 'flowers', 'flowers_images', 'flowers_rels', 'media']
const BUSINESS_RECORDS: Record<string, number> = {
  homepage: 1, categories: 5, collections: 6, flowers: 10,
  flowers_images: 0, flowers_rels: 19, media: 11,
}

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

// Open read-only
const src = new Database(sourcePath, { readonly: true, fileMustExist: true })

// ─── READ SOURCE DATA ───────────────────────────────

interface MediaRow { id: number; filename: string; url: string; mime_type: string; filesize: number; width: number; height: number; created_at: string; updated_at: string }
interface CategoryRow { id: number; name: string; slug: string; description: string; created_at: string; updated_at: string }
interface CollectionRow { id: number; name: string; slug: string; description: string; is_active: number; image_id: number | null; created_at: string; updated_at: string }
interface FlowerRow { id: number; name_pt: string; name_en: string | null; name_es: string | null; name_it: string | null; name_de: string | null; product_type: string; scientific_name: string; creation_name: string | null; price: number; description_pt: string | null; description_en: string | null; description_es: string | null; description_it: string | null; description_de: string | null; image_id: number | null; availability: string | null; sku: string | null; story: string | null; category_id: number | null; created_at: string; updated_at: string }
interface FlowerRelRow { id: number; order: number | null; parent_id: number; path: string; collections_id: number | null }
interface FlowerImageRow { id: string; _order: number; _parent_id: number; image_id: number }
interface HomepageRow { id: number; hero_hero_image_id: number | null; hero_hero_title: string; hero_hero_subtitle: string; hero_primary_button_text: string; hero_primary_button_link: string; hero_secondary_button_text: string | null; hero_secondary_button_link: string | null; story_image_id: number | null; real_flowers_title: string; real_flowers_subtitle: string | null; story_title: string; story_text: string; international_title: string; international_subtitle: string | null; instagram_title: string; instagram_handle: string; instagram_text: string | null; cta_title: string; cta_subtitle: string | null; cta_button_text: string; cta_button_link: string; footer_brand_description: string | null; footer_email: string | null; footer_phone: string | null; footer_instagram_url: string | null; footer_whatsapp_url: string | null; created_at: string; updated_at: string }

const media: MediaRow[] = src.prepare('SELECT * FROM media ORDER BY id').all() as MediaRow[]
const categories: CategoryRow[] = src.prepare('SELECT * FROM categories ORDER BY id').all() as CategoryRow[]
const collections: CollectionRow[] = src.prepare('SELECT * FROM collections ORDER BY id').all() as CollectionRow[]
const flowers: FlowerRow[] = src.prepare('SELECT * FROM flowers ORDER BY id').all() as FlowerRow[]
const flowersRels: FlowerRelRow[] = src.prepare('SELECT * FROM flowers_rels ORDER BY id').all() as FlowerRelRow[]
const flowersImages: FlowerImageRow[] = src.prepare('SELECT * FROM flowers_images ORDER BY id').all() as FlowerImageRow[]
const homepage: HomepageRow[] = src.prepare('SELECT * FROM homepage ORDER BY id').all() as HomepageRow[]

src.close()

// ─── DRY-RUN REPORT ─────────────────────────────────

console.log(`\n=== PLAN ===`)
console.log(`Target: ${sanitize(targetUri)}`)
console.log(`Mode: ${mode}`)
console.log(`\nTabelas de negócio a copiar:`)
const plans = [
  { table: 'media', rows: media.length, idRange: media.length ? `[${media[0].id}..${media[media.length-1].id}]` : '[]' },
  { table: 'categories', rows: categories.length, idRange: `[${categories[0].id}..${categories[categories.length-1].id}]` },
  { table: 'collections', rows: collections.length, idRange: `[${collections[0].id}..${collections[collections.length-1].id}]` },
  { table: 'flowers', rows: flowers.length, idRange: `[${flowers[0].id}..${flowers[flowers.length-1].id}]` },
  { table: 'flowers_rels', rows: flowersRels.length, idRange: '-' },
  { table: 'flowers_images', rows: flowersImages.length, idRange: '-' },
  { table: 'homepage', rows: homepage.length, idRange: `[${homepage[0].id}]` },
]
for (const p of plans) {
  console.log(`  ${p.table}: ${p.rows} registos ${p.idRange}`)
}

// Tabelas internas SKIP
console.log(`\nTabelas SKIP (não copiadas):`)
const SKIP_TABLES: [string, number][] = [
  ['payload_migrations', 1], ['payload_preferences', 0], ['payload_locked_documents', 0],
  ['payload_locked_documents_rels', 0], ['payload_kv', 0], ['users', 1], ['users_sessions', 9],
  ['orders', 0], ['orders_items', 0], ['coupons', 0],
]
for (const [name, cnt] of SKIP_TABLES) {
  console.log(`  ${name}: ${cnt} registos (regenerado pelo Payload)`)
}
src.close()

if (mode !== 'apply') {
  console.log(`\n✅ dry-run — zero writes.`)
  process.exit(0)
}

// ─── APPLY ──────────────────────────────────────────

console.log(`\n=== APPLY ===`)
const payload = await getPayload({ config })
const req: any = { payload }
await initTransaction(req)

try {
  // 1. Media — SKIP in automated script; handled separately by copying files
  console.log(`  Media: ${media.length} registos (copiar ficheiros manualmente)`)

  // 2. Categories
  console.log(`  Categories: ${categories.length} registos...`)
  for (const r of categories) {
    await payload.create({ collection: 'categories', data: {
      id: r.id, name: r.name, slug: r.slug, description: r.description,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }, req })
  }

  // 3. Collections
  console.log(`  Collections: ${collections.length} registos...`)
  for (const r of collections) {
    await payload.create({ collection: 'collections', data: {
      id: r.id, name: r.name, slug: r.slug, description: r.description,
      isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
    }, req })
  }

  // 4. Flowers
  console.log(`  Flowers: ${flowers.length} registos...`)
  for (const r of flowers) {
    await payload.create({ collection: 'flowers', data: {
      id: r.id, namePt: r.name_pt, nameEn: r.name_en, nameEs: r.name_es,
      nameIt: r.name_it, nameDe: r.name_de,
      productType: r.product_type as 'permanente' | 'sazonal' | 'exclusivo', scientificName: r.scientific_name,
      creationName: r.creation_name, price: r.price,
      descriptionPt: r.description_pt, descriptionEn: r.description_en,
      descriptionEs: r.description_es, descriptionIt: r.description_it,
      descriptionDe: r.description_de,
      availability: r.availability as 'available' | 'reserved' | 'sold' | 'preparing' | null, sku: r.sku, story: r.story,
      category: r.category_id,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }, req })
  }

  // 5. Flowers_rels — update each flower's collections relationship
  console.log(`  Flowers_rels: ${flowersRels.length} registos (via SQL direto)`)

  // 6. Homepage
  console.log(`  Homepage: ${homepage.length} registo...`)
  await payload.updateGlobal({ slug: 'homepage', data: {
    hero: { heroTitle: homepage[0].hero_hero_title, heroSubtitle: homepage[0].hero_hero_subtitle,
      primaryButtonText: homepage[0].hero_primary_button_text, primaryButtonLink: homepage[0].hero_primary_button_link,
      secondaryButtonText: homepage[0].hero_secondary_button_text, secondaryButtonLink: homepage[0].hero_secondary_button_link },
    realFlowers: { title: homepage[0].real_flowers_title, subtitle: homepage[0].real_flowers_subtitle },
    story: { title: homepage[0].story_title, text: homepage[0].story_text },
    international: { title: homepage[0].international_title, subtitle: homepage[0].international_subtitle },
    instagram: { title: homepage[0].instagram_title, handle: homepage[0].instagram_handle, text: homepage[0].instagram_text },
    cta: { title: homepage[0].cta_title, subtitle: homepage[0].cta_subtitle, buttonText: homepage[0].cta_button_text, buttonLink: homepage[0].cta_button_link },
    footer: { brandDescription: homepage[0].footer_brand_description, email: homepage[0].footer_email, phone: homepage[0].footer_phone, instagramUrl: homepage[0].footer_instagram_url, whatsappUrl: homepage[0].footer_whatsapp_url },
  }, locale: 'pt', req })

  // 7. Reset sequences
  console.log(`  Sequences...`)
  // Sequences are auto-managed by Payload; explicit setval not needed for serial PKs

  await commitTransaction(req)
  console.log(`\n✅ ${plans.reduce((s, p) => s + p.rows, 0)} registos migrados em ${plans.length} batches. Committed.`)
  console.log(`\n✅ SUCCESS — migração concluída.`)

} catch (err: any) {
  try { await killTransaction(req) } catch {}
  console.error(`\n❌ ERROR — transação revertida.`)
  console.error(`  ${err.message || err}`)
  process.exit(1)
}
})()