/**
 * Test migration DOWN: verify schema restoration.
 * Uses the actual Drizzle db.execute from the Payload config.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import * as mig from '../src/migrations-pg/20260826_100000_realflowers_array_fix'

const uri = process.env.DATABASE_URI!
if (!uri) {
  console.error('DATABASE_URI required')
  process.exit(1)
}

async function main() {
  const payload = await getPayload({ config: configPromise })

  // Get the drizzle db instance from the adapter
  // The migration expects a db with execute(sql) method
  // where sql is the @payloadcms/db-postgres template object
  const db = (payload.db as any).drizzle ?? payload.db

  type Row = { column_name: string; data_type: string; is_nullable: string; column_default: string | null }
  let passed = 0
  let failed = 0
  function assert(cond: boolean, msg: string) {
    if (cond) { passed++; console.log('  ✅', msg) } else { failed++; console.log('  ❌', msg) }
  }

  // ── 1. Check current schema (varchar) ──────────────────────────────
  console.log('\n--- BEFORE DOWN: check current schema ---')
  const before = await db.execute(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'homepage_real_flowers_flowers'
    ORDER BY ordinal_position
  `)
  const beforeRows = before.rows as Row[]
  const idCol = beforeRows.find((r: Row) => r.column_name === 'id')
  assert(idCol?.data_type === 'character varying', 'id is varchar before DOWN')
  assert(!beforeRows.find((r: Row) => r.column_name === 'name'), 'name is absent before DOWN')

  // ── 2. Test DOWN with content (should abort) ───────────────────────
  console.log('\n--- DOWN with content (should ABORT) ---')
  try {
    await mig.down({ db, payload, req: null })
    console.log('  ❌ DOWN should have aborted but did not!')
    failed++
  } catch (e: any) {
    assert(e.message.includes('ABORTED'), 'DOWN aborted with content: ' + e.message.split('\n')[0])
  }

  // ── 3. Empty the array via Payload ─────────────────────────────────
  console.log('\n--- Empty array via Payload ---')
  await payload.updateGlobal({
    slug: 'homepage',
    data: {
      hero: { heroTitle: 'T', heroSubtitle: 'S', primaryButtonText: 'B', primaryButtonLink: '/' },
      realFlowers: { title: 'F', subtitle: null, flowers: [] },
      story: { title: 'T', text: 'T' },
      international: { title: 'T', subtitle: null },
      instagram: { title: 'T', handle: '@t', text: null },
      cta: { title: 'T', subtitle: null, buttonText: 'B', buttonLink: '/' },
    },
    locale: 'pt',
  })

  // Verify empty
  const emptyCheck = await db.execute(`SELECT COUNT(*)::int AS cnt FROM homepage_real_flowers_flowers`)
  assert(emptyCheck.rows[0].cnt === 0, 'Array is empty')
  const emptyLocCheck = await db.execute(`SELECT COUNT(*)::int AS cnt FROM homepage_real_flowers_flowers_locales`)
  assert(emptyLocCheck.rows[0].cnt === 0, 'Locales table is empty')

  // ── 4. Apply DOWN ──────────────────────────────────────────────────
  console.log('\n--- Apply DOWN migration ---')
  try {
    await mig.down({ db, payload, req: null })
    console.log('  ✅ DOWN succeeded')
    passed++
  } catch (e: any) {
    console.log('  ❌ DOWN failed:', e.message)
    failed++
  }

  // ── 5. Verify schema restored ──────────────────────────────────────
  console.log('\n--- AFTER DOWN: verify schema restored ---')
  const after = await db.execute(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'homepage_real_flowers_flowers'
    ORDER BY ordinal_position
  `)
  const afterRows = after.rows as Row[]
  const idAfter = afterRows.find((r: Row) => r.column_name === 'id')
  assert(idAfter?.data_type === 'integer', 'id is integer after DOWN')
  assert(
    idAfter?.column_default?.includes('nextval') ?? false,
    'id has sequence default: ' + (idAfter?.column_default || 'none'),
  )
  assert(
    Boolean(afterRows.find((r: Row) => r.column_name === 'name')),
    'name column exists after DOWN',
  )
  const nameCol = afterRows.find((r: Row) => r.column_name === 'name')
  assert(
    nameCol?.is_nullable === 'NO',
    'name is NOT NULL after DOWN',
  )

  // Locales schema
  const locAfter = await db.execute(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'homepage_real_flowers_flowers_locales'
    ORDER BY ordinal_position
  `)
  const locRows = locAfter.rows as Row[]
  const parentId = locRows.find((r: Row) => r.column_name === '_parent_id')
  assert(parentId?.data_type === 'integer', 'locales _parent_id is integer after DOWN: ' + (parentId?.data_type || 'none'))

  console.log(`\n--- ${passed} passed, ${failed} failed ---`)
  await payload.db?.destroy?.()
  process.exit(failed > 0 ? 1 : 0)
}
main()