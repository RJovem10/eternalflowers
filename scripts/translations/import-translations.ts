/**
 * Importador Transacional e Idempotente de Traduções — E6E
 *
 * Uso:
 *   npm run translations:validate
 *   npm run translations:import -- --dry-run --snapshot-dir=/tmp/eternal-translations
 *   npm run translations:import -- --apply --confirm=IMPORT_TRANSLATIONS --snapshot-dir=/tmp/eternal-translations
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getPayload, initTransaction, commitTransaction, killTransaction } from 'payload'
import config from '../../src/payload.config.js'
import { loadAndValidateAllManifests, checkMirrors } from './lib/manifest'

const LOCALES = ['en', 'es', 'it', 'de'] as const
const REQUIRED_HOMEPAGE = [
  'hero.heroTitle', 'hero.heroSubtitle', 'hero.primaryButtonText',
  'realFlowers.title', 'story.title', 'story.text',
  'international.title', 'instagram.title', 'cta.title', 'cta.buttonText'
]

function sha256(t: string) { return crypto.createHash('sha256').update(t, 'utf-8').digest('hex').slice(0, 12) }
function isProd() { return process.env.NODE_ENV === 'production' }
function isProdDB(u: string) {
  const l = u.toLowerCase()
  if (l.includes('contabo') || l.includes('vps') || l.includes('prod')) return true
  if (l.startsWith('postgres://') && !l.includes('localhost') && !l.includes('127.0.0.1') && !l.includes('::1')) return true
  return false
}
function sanitize(u: string) { return u.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }
function abort(m: string): never { console.error(`\n❌ ABORT: ${m}`); process.exit(1) }
function log(m: string) { console.log(`  ${m}`) }

;(async () => {

const args = process.argv.slice(2)
let mode: 'validate' | 'dry-run' | 'apply' = 'dry-run'
let confirmToken = '', snapshotDir = '', verbose = false
let testMode = process.env.TRANSLATION_IMPORT_TEST_MODE ? '1' : '', testFailAfter = Number(process.env.TRANSLATION_IMPORT_TEST_MODE) || -1

for (const a of args) {
  if (a === '--dry-run') mode = 'dry-run'
  else if (a === '--apply') mode = 'apply'
  else if (a.startsWith('--confirm=')) confirmToken = a.split('=')[1]
  else if (a.startsWith('--snapshot-dir=')) snapshotDir = a.split('=')[1]
  else if (a === '--verbose') verbose = true
  else abort(`Unknown argument: ${a}`)
}

if (mode === 'apply' && confirmToken !== 'IMPORT_TRANSLATIONS') abort('--apply requires --confirm=IMPORT_TRANSLATIONS')
if (mode === 'apply' && !snapshotDir) abort('--apply requires --snapshot-dir=<path>')

const uri = process.env.DATABASE_URI || ''
if (isProd()) abort('NODE_ENV=production detected')
if (isProdDB(uri)) abort(`Production database: ${sanitize(uri)}`)

const MANIFEST_DIR = path.resolve(__dirname, '../../translations')
const { results, sources, manifests } = loadAndValidateAllManifests(fs, path, MANIFEST_DIR)

let totalValid = 0, totalErrors = 0
for (const r of results) {
  if (r.valid) { totalValid++; log(`✅ ${r.entity}: ${r.fieldCount} fields, ${r.translationCount} translations`) }
  else { totalErrors++; console.error(`❌ ${r.entity}: ${r.errors.join(', ')}`) }
}
if (totalErrors > 0) abort(`${totalErrors} manifest validation errors`)

// Mirrors
for (const entity of ['homepage', 'categories', 'collections', 'flowers'] as const) {
  const agg = manifests[entity]
  if (!agg) continue
  for (const loc of LOCALES) {
    const mp = path.join(MANIFEST_DIR, `${entity}-${loc}.json`)
    if (!fs.existsSync(mp)) abort(`Mirror missing: ${entity}-${loc}.json`)
    const mirror = JSON.parse(fs.readFileSync(mp, 'utf-8'))
    const mc = checkMirrors(agg, mirror, entity, loc)
    if (!mc.matched) abort(`Mirror ${entity}/${loc}: ${mc.diffs.join('; ')}`)
  }
  log(`✅ ${entity}: mirrors ok`)
}

log(`\nInitializing Payload with ${sanitize(uri)}...`)
const payload = await getPayload({ config })

const hpDoc = await payload.findGlobal({ slug: 'homepage', locale: 'pt', fallbackLocale: false })
const hpId = (hpDoc as any).id

const catDocs = await payload.find({ collection: 'categories', limit: 20, locale: 'pt', fallbackLocale: false })
const cats: Record<string, any> = {}
for (const d of catDocs.docs as any[]) cats[d.slug] = d

const colDocs = await payload.find({ collection: 'collections', limit: 20, locale: 'pt', fallbackLocale: false })
const colls: Record<string, any> = {}
for (const d of colDocs.docs as any[]) colls[d.slug] = d

const flDocs = await payload.find({ collection: 'flowers', limit: 20, locale: 'pt', fallbackLocale: false })
const fls: Record<string, any> = {}
for (const d of flDocs.docs as any[]) fls[d.id] = d

// Source hash validation — compares manifest sourceHash against DB PT values
let srcErr = 0
for (const s of sources) {
  const expectedHash = s.hash
  let dbVal = ''
  // Read PT value from DB via Local API (no fallback)
  if (s.entity === 'homepage') {
    const hp = await payload.findGlobal({ slug: 'homepage', locale: 'pt', fallbackLocale: false }) as any
    const [grp, fld] = s.field.split('.')
    dbVal = hp[grp]?.[fld] ?? ''
  } else if (s.entity === 'flowers') {
    const id = parseInt(s.field.match(/flower-(\d+)/)?.[1] || '0', 10)
    if (id && fls[id]) {
      const fn = s.field.split('.')[1]
      // Try PT-specific field first, then base field
      dbVal = fls[id][fn + 'Pt'] || fls[id][fn] || ''
    }
  } else {
    const slugVal = s.field.split('.')[0]
    const fn = s.field.split('.')[1]
    const docs = s.entity === 'categories' ? cats : colls
    if (docs[slugVal]) {
      dbVal = docs[slugVal][fn] ?? ''
    }
  }
  const actualHash = 'sha256:' + sha256(dbVal)
  if (actualHash !== expectedHash) {
    console.error(`❌ ${s.entity}/${s.field}: SOURCE_DRIFT expected=sha256:${expectedHash} actual=sha256:${actualHash}`)
    srcErr++
  }
}

// Read existing translations
const plan: { entity: string; slug: string; field: string; locale: string; existing: string | null; planned: string; action: 'SKIP_IDENTICAL' | 'PLANNED_WRITE' | 'CONFLICT' }[] = []
function check(entity: string, slug: string, field: string, loc: string, existing: string | null | undefined, planned: string) {
  const e = existing || ''
  if (!e && planned) { plan.push({ entity, slug, field, locale: loc, existing: e || null, planned, action: 'PLANNED_WRITE' }); return }
  if (e === planned) { plan.push({ entity, slug, field, locale: loc, existing: e, planned, action: 'SKIP_IDENTICAL' }); return }
  plan.push({ entity, slug, field, locale: loc, existing: e, planned, action: 'CONFLICT' })
}

for (const loc of LOCALES) {
  const d = await payload.findGlobal({ slug: 'homepage', locale: loc as any, fallbackLocale: false }) as any
  for (const fp of Object.keys(manifests.homepage.fields)) {
    const [grp, fld] = fp.split('.')
    check('homepage', 'homepage', fp, loc, d[grp]?.[fld], manifests.homepage.fields[fp].translations[loc].value)
  }
}
for (const slug of Object.keys(cats)) {
  for (const loc of LOCALES) {
    const d = await payload.findByID({ collection: 'categories', id: cats[slug].id, locale: loc as any, fallbackLocale: false }) as any
    check('categories', slug, 'name', loc, d.name, manifests.categories.fields[`${slug}.name`].translations[loc].value)
    check('categories', slug, 'description', loc, d.description, manifests.categories.fields[`${slug}.description`].translations[loc].value)
  }
}
for (const slug of Object.keys(colls)) {
  for (const loc of LOCALES) {
    const d = await payload.findByID({ collection: 'collections', id: colls[slug].id, locale: loc as any, fallbackLocale: false }) as any
    check('collections', slug, 'name', loc, d.name, manifests.collections.fields[`${slug}.name`].translations[loc].value)
    check('collections', slug, 'description', loc, d.description, manifests.collections.fields[`${slug}.description`].translations[loc].value)
  }
}
for (const idStr of Object.keys(fls)) {
  const id = Number(idStr)
  for (const loc of LOCALES) {
    const d = await payload.findByID({ collection: 'flowers', id, locale: loc as any, fallbackLocale: false }) as any
    check('flowers', `flower-${id}`, 'story', loc, d.story, manifests.flowers.fields[`flower-${id}.story`].translations[loc].value)
  }
}
// Suffix: read from the PT-loaded flower objects (they have all suffix fields)
for (const idStr of Object.keys(fls)) {
  const id = Number(idStr)
  const d = fls[id] as any
  for (const loc of LOCALES) {
    const nf = `name${loc.charAt(0).toUpperCase() + loc.slice(1)}`
    const df = `description${loc.charAt(0).toUpperCase() + loc.slice(1)}`
    check('flowers', `flower-${id}`, nf, loc, d[nf], manifests.flowers.fields[`flower-${id}.name`].translations[loc].value)
    check('flowers', `flower-${id}`, df, loc, d[df], manifests.flowers.fields[`flower-${id}.description`].translations[loc].value)
  }
}

const conflicts = plan.filter(p => p.action === 'CONFLICT')
const identical = plan.filter(p => p.action === 'SKIP_IDENTICAL')
const writes = plan.filter(p => p.action === 'PLANNED_WRITE')

if (conflicts.length > 0) {
  console.error(`\n❌ ${conflicts.length} CONFLICT(S)`)
  for (const c of conflicts) console.error(`  ${c.entity}/${c.slug}/${c.field} (${c.locale})`)
  abort('Conflicts — zero writes')
}

const totalTranslations = Object.values(manifests).reduce((s: number, m: any) => s + Object.keys(m.fields).length * LOCALES.length, 0)
console.log(`\n=== PLAN ===\nDB: ${sanitize(uri)}\nMode: ${mode}\nSources: ${sources.length}\nTotal: ${totalTranslations}\nWrites: ${writes.length}\nSkips: ${identical.length}\nConflicts: ${conflicts.length}`)

fs.mkdirSync(snapshotDir, { recursive: true })
const snapPath = path.join(snapshotDir, `snapshot-${Date.now()}.json`)
fs.writeFileSync(snapPath, JSON.stringify({
  timestamp: new Date().toISOString(), database: sanitize(uri), mode,
  plan: plan.map(p => ({ entity: p.entity, slug: p.slug, field: p.field, locale: p.locale, action: p.action })),
  counts: { totalTranslations, writes: writes.length, skips: identical.length, conflicts: conflicts.length }
}, null, 2))
console.log(`Snapshot: ${snapPath}`)

if (mode !== 'apply') { console.log(`\n✅ ${mode} — zero writes.`); process.exit(0) }

// ─── APPLY ────────────────────────────────────────
console.log(`\n=== APPLYING ===`)
const req: any = { payload }
await initTransaction(req)
let ops = 0, errs: string[] = []

try {
  for (const loc of LOCALES) {
    // Read current homepage to get all field values (preserves NOT NULL constraints)
    const currHP = await payload.findGlobal({ slug: 'homepage', locale: 'pt', fallbackLocale: false }) as any
    const data: any = {}
    // Start with current PT state for all groups
    for (const [grp, fields] of Object.entries(currHP)) {
      if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
        data[grp] = { ...fields }
      }
    }
    // Overwrite localized fields with translation values for this locale
    for (const fp of Object.keys(manifests.homepage.fields)) {
      const [grp, fld] = fp.split('.')
      // Skip shared (non-localized) fields — they must not be sent in locale updates
      const sharedFields = ['heroImage', 'primaryButtonLink', 'secondaryButtonLink']
      const sharedSubFields: Record<string, string[]> = {
        story: ['image'],
        instagram: ['handle'],
        cta: ['buttonLink'],
        footer: ['email', 'phone', 'instagramUrl', 'whatsappUrl']
      }
      if (fld === 'heroImage') continue
      if (sharedSubFields[grp]?.includes(fld)) continue
      if (!data[grp]) data[grp] = {}
      data[grp][fld] = manifests.homepage.fields[fp].translations[loc].value
    }
    await payload.updateGlobal({ slug: 'homepage', data, locale: loc as any, req })
    ops++
    if (testMode && ops === Number(testFailAfter)) throw new Error(`INJECTED_FAILURE at op ${ops}`)
  }

  for (const slug of Object.keys(cats)) {
    for (const loc of LOCALES) {
      await payload.update({ collection: 'categories', id: cats[slug].id, data: {
        name: manifests.categories.fields[`${slug}.name`].translations[loc].value,
        description: manifests.categories.fields[`${slug}.description`].translations[loc].value,
      }, locale: loc as any, req })
      ops++
      if (testMode && ops === Number(testFailAfter)) throw new Error(`INJECTED_FAILURE at op ${ops}`)
    }
  }

  for (const slug of Object.keys(colls)) {
    for (const loc of LOCALES) {
      await payload.update({ collection: 'collections', id: colls[slug].id, data: {
        name: manifests.collections.fields[`${slug}.name`].translations[loc].value,
        description: manifests.collections.fields[`${slug}.description`].translations[loc].value,
      }, locale: loc as any, req })
      ops++
      if (testMode && ops === Number(testFailAfter)) throw new Error(`INJECTED_FAILURE at op ${ops}`)
    }
  }

  for (const idStr of Object.keys(fls)) {
    const id = Number(idStr)
    for (const loc of LOCALES) {
      await payload.update({ collection: 'flowers', id, data: { story: manifests.flowers.fields[`flower-${id}.story`].translations[loc].value }, locale: loc as any, req })
      ops++
      if (testMode && ops === Number(testFailAfter)) throw new Error(`INJECTED_FAILURE at op ${ops}`)
    }
  }

  for (const idStr of Object.keys(fls)) {
    const id = Number(idStr)
    const data: any = {}
    for (const loc of LOCALES) {
      const nf = `name${loc.charAt(0).toUpperCase() + loc.slice(1)}`
      const df = `description${loc.charAt(0).toUpperCase() + loc.slice(1)}`
      data[nf] = manifests.flowers.fields[`flower-${id}.name`].translations[loc].value
      data[df] = manifests.flowers.fields[`flower-${id}.description`].translations[loc].value
    }
    await payload.update({ collection: 'flowers', id, data, req })
    ops++
    if (testMode && ops === Number(testFailAfter)) throw new Error(`INJECTED_FAILURE at op ${ops}`)
  }

  // Verify
  for (const p of writes) {
    let v: any
    if (p.entity === 'homepage') {
      v = await payload.findGlobal({ slug: 'homepage', locale: p.locale as any, fallbackLocale: false }) as any
      const [grp, fld] = p.field.split('.')
      if (v[grp]?.[fld] !== p.planned) errs.push(`VERIFY ${p.entity}/${p.field} (${p.locale})`)
    } else if (['categories', 'collections'].includes(p.entity)) {
      const map = p.entity === 'categories' ? cats : colls
      v = await payload.findByID({ collection: p.entity as any, id: map[p.slug].id, locale: p.locale as any, fallbackLocale: false }) as any
      if (v[p.field] !== p.planned) errs.push(`VERIFY ${p.entity}/${p.slug}/${p.field} (${p.locale})`)
    } else {
      const id = Number(p.slug.replace('flower-', ''))
      if (p.field === 'story') {
        v = await payload.findByID({ collection: 'flowers', id, locale: p.locale as any, fallbackLocale: false }) as any
        if (v.story !== p.planned) errs.push(`VERIFY flowers/${p.slug}/story (${p.locale})`)
      } else {
        v = await payload.findByID({ collection: 'flowers', id, locale: 'pt' as any, fallbackLocale: false }) as any
        if (v[p.field] !== p.planned) errs.push(`VERIFY flowers/${p.slug}/${p.field} (${p.locale})`)
      }
    }
  }

  if (errs.length > 0) {
    await commitTransaction(req)
    console.error(`\n❌ ${errs.length} verification errors after commit!`)
    for (const e of errs) console.error(`  ${e}`)
    process.exit(1)
  }

  await commitTransaction(req)
  console.log(`\n✅ ${writes.length} translations in ${ops} ops. Committed.`)
} catch (err: any) {
  // Explicit rollback
  try { await killTransaction(req) } catch (rb) { console.error('Rollback error:', rb) }
  console.error(`\n❌ ERROR — transaction rolled back.`)
  console.error(`  ${err.message || err}`)
  process.exit(1)
}

const dur = process.uptime()
console.log(`\n=== IMPORT COMPLETE ===`)
console.log(`DB: ${sanitize(uri)}\nMode: ${mode}\nTotal: ${totalTranslations}\nWrites: ${writes.length}\nOps: ${ops}\nSkips: ${identical.length}\nConflicts: ${conflicts.length}\nDuration: ${dur.toFixed(1)}s\nSnapshot: ${snapPath}`)
console.log(`\n✅ SUCCESS — zero errors.`)
process.exit(0)

})()