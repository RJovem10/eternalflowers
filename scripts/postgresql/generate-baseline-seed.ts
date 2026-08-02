#!/usr/bin/env npx tsx
/**
 * generate-baseline-seed.ts
 *
 * Lê os ficheiros de manifesto de tradução (translations/*.json) e gera
 * instruções SQL INSERT para a base de dados PostgreSQL — homepage,
 * categories, collections, flowers e flowers_rels.
 *
 * Uso:
 *   npx tsx scripts/postgresql/generate-baseline-seed.ts > scripts/seed-pg-baseline.sql
 *   psql "$DATABASE_URI" < scripts/seed-pg-baseline.sql
 */

import { readFileSync, existsSync } from 'fs'
import { createHash } from 'crypto'

// ─── Helpers ───────────────────────────────────────────────────────────────

const ROOT = new URL('../..', import.meta.url).pathname

function readJSON<T>(rel: string): T {
  const p = `${ROOT}${rel}`
  if (!existsSync(p)) throw new Error(`Ficheiro não encontrado: ${p}`)
  return JSON.parse(readFileSync(p, 'utf-8'))
}

/** Escapa string para literal PostgreSQL (E'...') com escapamento de backslash e plicas. */
function esc(val: string | null | undefined): string {
  if (val == null) return 'NULL'
  // Escapar \ e ' para usar E'...'
  const s = String(val).replace(/\\/g, '\\\\').replace(/'/g, "''")
  return `E'${s}'`
}

/** Escapa string curta sem sufixo E (para valores simples). */
function escSimple(val: string | null | undefined): string {
  if (val == null) return 'NULL'
  const s = String(val).replace(/'/g, "''")
  // Só usa E'' se houver backslash
  if (s.includes('\\')) return `E'${s.replace(/\\/g, '\\\\')}'`
  return `'${s}'`
}

/** Escapa numeric */
function escNum(val: number | null | undefined): string {
  if (val == null) return 'NULL'
  return String(val)
}

/** Escapa boolean */
function escBool(val: boolean | null | undefined): string {
  if (val == null) return 'NULL'
  return val ? 'true' : 'false'
}

/** Gera timestamp ISO para now() */
function nowSQL(): string {
  return `'${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}+00'`
}

// ─── Tipos dos manifestos ──────────────────────────────────────────────────

interface TranslationEntry {
  value: string
  status: string
  notes: string
}

interface ManifestField {
  required: boolean
  source: string
  sourceHash: string
  translations: Record<string, TranslationEntry>
}

interface Manifest {
  version: number
  entity: string
  slug: string
  sourceLocale: string
  targetLocales: string[]
  fields: Record<string, ManifestField>
}

// ─── Dados complementares que NÃO estão nos manifestos ─────────────────────

interface FlowerMeta {
  id: number
  scientificName: string
  productType: string
  price: number
  sku: string
  categorySlug: string
}

const FLOWER_META: FlowerMeta[] = [
  { id: 1,  scientificName: 'Cattleya',           productType: 'permanente', price: 49.9, sku: 'flower-1', categorySlug: 'colares' },
  { id: 2,  scientificName: 'Cattleya',           productType: 'permanente', price: 39.9, sku: 'flower-2', categorySlug: 'brincos' },
  { id: 3,  scientificName: 'Sobrália',           productType: 'permanente', price: 59.9, sku: 'flower-3', categorySlug: 'pulseiras' },
  { id: 4,  scientificName: 'Cambria',            productType: 'permanente', price: 34.9, sku: 'flower-4', categorySlug: 'porta-chaves' },
  { id: 5,  scientificName: 'Phalaenopsis',       productType: 'permanente', price: 69.9, sku: 'flower-5', categorySlug: 'molduras' },
  { id: 6,  scientificName: 'Laelia',             productType: 'permanente', price: 54.9, sku: 'flower-6', categorySlug: 'colares' },
  { id: 7,  scientificName: 'Vanda',              productType: 'permanente', price: 44.9, sku: 'flower-7', categorySlug: 'brincos' },
  { id: 8,  scientificName: 'Paphiopedilum',      productType: 'permanente', price: 64.9, sku: 'flower-8', categorySlug: 'pulseiras' },
  { id: 9,  scientificName: 'Cattleya',           productType: 'permanente', price: 39.9, sku: 'flower-9', categorySlug: 'porta-chaves' },
  { id: 10, scientificName: 'Cattleya',           productType: 'permanente', price: 79.9, sku: 'flower-10', categorySlug: 'molduras' },
]

interface FlowerColMap {
  id: number
  collectionSlugs: string[]
}

const FLOWER_COLLECTIONS: FlowerColMap[] = [
  { id: 1,  collectionSlugs: ['casamentos', 'dia-da-mae', 'memorias'] },
  { id: 2,  collectionSlugs: ['memorias', 'dia-da-mae'] },
  { id: 3,  collectionSlugs: ['casamentos', 'memorias'] },
  { id: 4,  collectionSlugs: ['memorias'] },
  { id: 5,  collectionSlugs: ['dia-da-mae', 'casamentos', 'memorias'] },
  { id: 6,  collectionSlugs: ['dia-da-mae', 'memorias'] },
  { id: 7,  collectionSlugs: ['memorias'] },
  { id: 8,  collectionSlugs: ['casamentos', 'memorias'] },
  { id: 9,  collectionSlugs: ['memorias'] },
  { id: 10, collectionSlugs: ['dia-da-mae', 'memorias'] },
]

const COLLECTION_SLUGS_ORDERED = [
  'casamentos',
  'dia-da-mae',
  'edicao-limitada',
  'memorias',
  'natureza',
  'primavera',
]

const CATEGORY_SLUGS_ORDERED = [
  'brincos',
  'colares',
  'molduras',
  'porta-chaves',
  'pulseiras',
]

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const lines: string[] = []

  lines.push('--')
  lines.push('-- Baseline seed gerado por generate-baseline-seed.ts')
  lines.push(`-- Data: ${new Date().toISOString()}`)
  lines.push('--')
  lines.push('-- Este ficheiro é AUTO-GERADO. Não editar manualmente.')
  lines.push('-- Para regenerar: npx tsx scripts/postgresql/generate-baseline-seed.ts > scripts/seed-pg-baseline.sql')
  lines.push('--')

  // ── Ler manifestos ─────────────────────────────────────────────────────
  const hpManifest     = readJSON<Manifest>('translations/homepage.json')
  const catManifest    = readJSON<Manifest>('translations/categories.json')
  const colManifest    = readJSON<Manifest>('translations/collections.json')
  const flowersManifest = readJSON<Manifest>('translations/flowers.json')

  const now = nowSQL()

  // ══════════════════════════════════════════════════════════════════════
  // HOMEPAGE
  // ══════════════════════════════════════════════════════════════════════

  // Mapeamento: campo do manifesto -> coluna(s) SQL
  // homepage usa colunas achatadas (group_field)
  const HP_FIELD_MAP: Record<string, string> = {
    'hero.heroTitle':         'hero_hero_title',
    'hero.heroSubtitle':      'hero_hero_subtitle',
    'hero.primaryButtonText': 'hero_primary_button_text',
    'hero.secondaryButtonText': 'hero_secondary_button_text',
    'realFlowers.title':      'real_flowers_title',
    'realFlowers.subtitle':   'real_flowers_subtitle',
    'story.title':            'story_title',
    'story.text':             'story_text',
    'international.title':    'international_title',
    'international.subtitle': 'international_subtitle',
    'instagram.title':        'instagram_title',
    'instagram.text':         'instagram_text',
    'cta.title':              'cta_title',
    'cta.subtitle':           'cta_subtitle',
    'cta.buttonText':         'cta_button_text',
    'footer.brandDescription': 'footer_brand_description',
  }

  const HP_STATIC: Record<string, string> = {
    hero_primary_button_link:  '/catalog',
    hero_secondary_button_link: '/catalog',
    instagram_handle:          'eternal.flowers.pt',
    cta_button_link:           '/catalog',
    footer_email:              'loja@eternalflowers.pt',
    footer_phone:              '+351****9999',
    footer_instagram_url:      'https://instagram.com/eternal.flowers.pt',
    footer_whatsapp_url:       'https://wa.me/351999999999',
  }

  const hpCols: string[] = []
  const hpVals: string[] = []

  // Campos do manifesto
  for (const [manifestKey, sqlCol] of Object.entries(HP_FIELD_MAP)) {
    const field = hpManifest.fields[manifestKey]
    if (!field) {
      console.error(`⚠️  Homepage: campo "${manifestKey}" não encontrado no manifesto`)
      continue
    }
    hpCols.push(sqlCol)
    hpVals.push(esc(field.source))
  }

  // Campos estáticos
  for (const [col, val] of Object.entries(HP_STATIC)) {
    hpCols.push(col)
    hpVals.push(esc(val))
  }

  // created_at / updated_at
  hpCols.push('created_at', 'updated_at')
  hpVals.push(now, now)

  lines.push('')
  lines.push('-- HOMEPAGE')
  lines.push(`INSERT INTO homepage (id, ${hpCols.join(', ')})`)
  lines.push(`VALUES (1, ${hpVals.join(', ')})`)
  lines.push(`ON CONFLICT (id) DO UPDATE SET`)
  lines.push(`  ${hpCols.filter(c => c !== 'created_at').map(c => `"${c}" = EXCLUDED."${c}"`).join(',\n  ')};`)

  // ══════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ══════════════════════════════════════════════════════════════════════

  lines.push('')
  lines.push('-- CATEGORIES')

  for (const slug of CATEGORY_SLUGS_ORDERED) {
    const nameField = catManifest.fields[`${slug}.name`]
    const descField = catManifest.fields[`${slug}.description`]

    if (!nameField) {
      console.error(`⚠️  Category "${slug}": campo name não encontrado`)
      continue
    }

    const name = nameField.source
    const description = descField ? descField.source : null

    lines.push(`INSERT INTO categories (slug, name, description, created_at, updated_at)`)
    lines.push(`  VALUES (${escSimple(slug)}, ${esc(name)}, ${esc(description)}, ${now}, ${now})`)
    lines.push(`  ON CONFLICT (slug) DO UPDATE SET`)
    lines.push(`    name = EXCLUDED.name, description = EXCLUDED.description;`)
  }

  // ══════════════════════════════════════════════════════════════════════
  // COLLECTIONS
  // ══════════════════════════════════════════════════════════════════════

  lines.push('')
  lines.push('-- COLLECTIONS')

  for (const slug of COLLECTION_SLUGS_ORDERED) {
    const nameField = colManifest.fields[`${slug}.name`]
    const descField = colManifest.fields[`${slug}.description`]

    if (!nameField) {
      console.error(`⚠️  Collection "${slug}": campo name não encontrado`)
      continue
    }

    const name = nameField.source
    const description = descField ? descField.source : null

    lines.push(`INSERT INTO collections (slug, name, description, is_active, created_at, updated_at)`)
    lines.push(`  VALUES (${escSimple(slug)}, ${esc(name)}, ${esc(description)}, true, ${now}, ${now})`)
    lines.push(`  ON CONFLICT (slug) DO UPDATE SET`)
    lines.push(`    name = EXCLUDED.name, description = EXCLUDED.description;`)
  }

  // ══════════════════════════════════════════════════════════════════════
  // FLOWERS
  // ══════════════════════════════════════════════════════════════════════

  lines.push('')
  lines.push('-- FLOWERS')

  for (const meta of FLOWER_META) {
    const prefix = `flower-${meta.id}`
    const nameField = flowersManifest.fields[`${prefix}.name`]
    const descField = flowersManifest.fields[`${prefix}.description`]
    const storyField = flowersManifest.fields[`${prefix}.story`]

    if (!nameField) {
      console.error(`⚠️  Flower "${prefix}": campo name não encontrado`)
      continue
    }

    const namePt = nameField.source
    const descriptionPt = descField ? descField.source : null
    const story = storyField ? storyField.source : null

    // category_id resolve com subquery pelo slug
    lines.push(`INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id, created_at, updated_at)`)
    lines.push(`  VALUES (${meta.id}, ${esc(namePt)}, ${escSimple(meta.productType)}, ${escSimple(meta.scientificName)}, ${escNum(meta.price)}, ${esc(descriptionPt)}, ${escSimple(meta.sku)}, ${esc(story)},`)
    lines.push(`    (SELECT id FROM categories WHERE slug = ${escSimple(meta.categorySlug)}), ${now}, ${now})`)
    lines.push(`  ON CONFLICT (id) DO UPDATE SET`)
    lines.push(`    name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt,`)
    lines.push(`    story = EXCLUDED.story, price = EXCLUDED.price;`)
  }

  // ══════════════════════════════════════════════════════════════════════
  // FLOWERS_RELS (flower → collections many-to-many)
  // ══════════════════════════════════════════════════════════════════════

  lines.push('')
  lines.push('-- FLOWERS_RELS (coleções)')

  for (const fm of FLOWER_COLLECTIONS) {
    for (let order = 0; order < fm.collectionSlugs.length; order++) {
      const colSlug = fm.collectionSlugs[order]
      lines.push(`INSERT INTO flowers_rels ("order", parent_id, path, collections_id)`)
      lines.push(`  VALUES (${order}, ${fm.id}, ${escSimple('collections')},`)
      lines.push(`    (SELECT id FROM collections WHERE slug = ${escSimple(colSlug)}))`)
      lines.push(`  ON CONFLICT DO NOTHING;`)
    }
  }

  // ── Verification query ────────────────────────────────────────────────
  lines.push('')
  lines.push('-- Verify')
  lines.push(`SELECT 'hp' AS t, COUNT(*) FROM homepage UNION ALL SELECT 'cat', COUNT(*) FROM categories UNION ALL SELECT 'col', COUNT(*) FROM collections UNION ALL SELECT 'fl', COUNT(*) FROM flowers ORDER BY t;`)

  // Output
  console.log(lines.join('\n'))
}

main()