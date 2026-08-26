/**
 * E2E test: RealFlowers array fix — validate via real Payload API.
 *
 * Tests:
 *  1. Save homepage with realFlowers.flowers (1 flower, PT)
 *  2. Readback and verify
 *  3. Update name in EN locale
 *  4. Verify PT preserved after EN write
 *  5. Array with 7 flowers
 *  6. Array with 12 flowers
 *  7. Upload media + relationship
 *  8. Verify no maxRows constraint
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const uri = process.env.TEST_DATABASE_URI
if (!uri) {
  console.error('TEST_DATABASE_URI required')
  process.exit(1)
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ ${msg}`)
      passed++
    } else {
      console.log(`  ❌ ${msg}`)
      failed++
    }
  }

  try {
    // ─── Test 1: Save Homepage with 1 flower (PT) ──────────────────
    console.log('\n--- Test 1: Save homepage with 1 flower (PT) ---')
    const hp1 = await payload.updateGlobal({
      slug: 'homepage',
      data: {
        hero: {
          heroTitle: 'Test Title',
          heroSubtitle: 'Test Subtitle',
          primaryButtonText: 'Shop',
          primaryButtonLink: '/catalog',
        },
        realFlowers: {
          title: 'Flores Verdadeiras',
          subtitle: 'Beleza natural',
          flowers: [
            {
              name: 'Orquídea Vanda',
              scientificName: 'Vanda coerulea',
            },
          ],
        },
        story: { title: 'Nossa História', text: 'Texto da história' },
        international: { title: 'Internacional', subtitle: 'Mundo' },
        instagram: { title: 'Instagram', handle: '@eternalflowers', text: 'Follow us' },
        cta: { title: 'CTA', subtitle: 'Call', buttonText: 'Click', buttonLink: '/contact' },
      },
      locale: 'pt',
    })

    const hp1Read = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    const flowers = hp1Read.realFlowers?.flowers
    assert(flowers?.length === 1, '1 flower saved')
    assert(flowers?.[0]?.name === 'Orquídea Vanda', 'Flower name is Orquídea Vanda')
    assert(flowers?.[0]?.scientificName === 'Vanda coerulea', 'Scientific name correct')
    const flowerId = flowers?.[0]?.id
    console.log('  Flower ID:', flowerId)

    // ─── Test 2: Readback ──────────────────────────────────────────
    console.log('\n--- Test 2: Readback ---')
    assert(flowerId !== undefined, 'Flower ID is defined')

    // ─── Test 3: Update name in EN locale ──────────────────────────
    console.log('\n--- Test 3: Update name in EN locale ---')
    await payload.updateGlobal({
      slug: 'homepage',
      data: {
        realFlowers: {
          flowers: flowerId ? [
            { id: flowerId, name: 'Vanda Orchid', scientificName: 'Vanda coerulea' },
          ] : [],
        },
      },
      locale: 'en',
    } as any)

    const hpEn = await payload.findGlobal({ slug: 'homepage', locale: 'en' })
    const hpPtAfter = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert(hpEn.realFlowers?.flowers?.[0]?.name === 'Vanda Orchid', 'EN name is Vanda Orchid')
    assert(hpPtAfter.realFlowers?.flowers?.[0]?.name === 'Orquídea Vanda', 'PT preserved after EN write')

    // ─── Test 4: Array with 7 flowers ──────────────────────────────
    console.log('\n--- Test 4: Array with 7 flowers ---')
    const seven = Array.from({ length: 7 }, (_, i) => ({
      name: `Flor ${i + 1}`,
      scientificName: `Spec${i + 1}`,
    }))
    await payload.updateGlobal({
      slug: 'homepage',
      data: { realFlowers: { title: 'Flores', flowers: seven } },
      locale: 'pt',
    } as any)
    const hp7 = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert(hp7.realFlowers?.flowers?.length === 7, '7 flowers in array')

    // ─── Test 5: Array with 12 flowers ─────────────────────────────
    console.log('\n--- Test 5: Array with 12 flowers (no maxRows) ---')
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      name: `Flor ${i + 1}`,
      scientificName: `Spec${i + 1}`,
    }))
    await payload.updateGlobal({
      slug: 'homepage',
      data: { realFlowers: { title: 'Flores', flowers: twelve } },
      locale: 'pt',
    } as any)
    const hp12 = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert(hp12.realFlowers?.flowers?.length === 12, '12 flowers (no maxRows)')

    // ─── Test 6: image field exists ────────────────────────────────
    console.log('\n--- Test 6: image field exists (nullable) ---')
    const hpRel = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert('image' in (hpRel.realFlowers?.flowers?.[0] || {}), 'image field exists')

    // ─── Test 7: Verify DB structure ───────────────────────────────
    console.log('\n--- Test 7: Verify DB structure ---')
    const { Pool } = require('pg')
    const pool = new Pool({ connectionString: uri })
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'homepage_real_flowers_flowers'
      ORDER BY ordinal_position
    `)
    const cols = res.rows.map((r: any) => r.column_name)
    assert(cols.includes('id'), 'id column exists')
    assert(cols.includes('scientific_name'), 'scientific_name column exists')
    assert(!cols.includes('name'), 'name column NOT in main table (localized)')
    const idCol = res.rows.find((r: any) => r.column_name === 'id')
    assert(idCol?.data_type === 'character varying', 'id is varchar (not integer)')
    await pool.end()

    console.log(`\n═══════════════════════════════════════`)
    console.log(` ✅ ${passed} passed, ${failed} failed`)
    console.log(`═══════════════════════════════════════`)
  } catch (err: any) {
    console.error('FATAL:', err.message)
    console.error(err.stack)
    process.exit(1)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main()