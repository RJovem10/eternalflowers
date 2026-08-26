/**
 * E2E test: RealFlowers array fix — validate via real Payload API.
 *
 * Tests:
 *  1. Seeded rows readback (before any updateGlobal!)
 *  2. Edit seeded row preserving IDs
 *  3. Second edit on same seeded entry
 *  4. Real Media relationship
 *  5. Save homepage with 1 flower (PT)
 *  6. Readback and verify
 *  7. Update name in EN locale, PT preserved
 *  8. Array with 7 flowers
 *  9. Array with 12 flowers (no maxRows)
 *  10. Verify DB structure
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const uri = process.env.DATABASE_URI
if (!uri) {
  console.error('DATABASE_URI required')
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
    // ─── FINDING 2: Test real seeded rows ─────────────────────────────
    console.log('\n═══════════════════════════════════════')
    console.log(' FINDING 2 — Test seeded rows via Payload')
    console.log('═══════════════════════════════════════')

    // This must be the FIRST findGlobal — before any updateGlobal changes the seed
    const hpSeed = await payload.findGlobal({ slug: 'homepage', locale: 'pt', depth: 0 })
    const seededFlowers = hpSeed.realFlowers?.flowers
    assert(seededFlowers?.length === 6, '6 seeded entries found in Payload')

    const expectedSeeds = [
      { name: 'Orquídea Vanda', scientificName: 'Vanda coerulea', idPrefix: 'seed_vanda_0001' },
      { name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio', idPrefix: 'seed_paphiopedilum_0002' },
      { name: 'Sobrália', scientificName: 'Sobralia rosea', idPrefix: 'seed_sobralia_0003' },
      { name: 'Cambria', scientificName: 'Cambria Africana', idPrefix: 'seed_cambria_0004' },
      { name: 'Laelia', scientificName: 'Laelia purpurata', idPrefix: 'seed_laelia_0005' },
      { name: 'Cattleya', scientificName: 'Cattleya spp.', idPrefix: 'seed_cattleya_0006' },
    ]

    for (let i = 0; i < expectedSeeds.length; i++) {
      const exp = expectedSeeds[i]
      const actual = seededFlowers?.[i]
      assert(actual?.name === exp.name, `Seed ${i + 1} name: "${exp.name}"`)
      assert(actual?.scientificName === exp.scientificName, `Seed ${i + 1} scientificName: "${exp.scientificName}"`)
      assert(String(actual?.id).startsWith(exp.idPrefix), `Seed ${i + 1} id starts with "${exp.idPrefix}"`)
    }

    // Helper: full homepage data with all required fields
    function fullHomepageData(overrides: Record<string, any> = {}) {
      return {
        hero: {
          heroTitle: 'Title',
          heroSubtitle: 'Subtitle',
          primaryButtonText: 'Shop',
          primaryButtonLink: '/catalog',
        },
        realFlowers: {
          title: 'Flores Verdadeiras',
          subtitle: 'Beleza natural',
          flowers: [],
        },
        story: { title: 'Nossa História', text: 'Texto da história' },
        international: { title: 'Internacional', subtitle: 'Mundo' },
        instagram: { title: 'Instagram', handle: '@eternalflowers', text: 'Follow us' },
        cta: { title: 'CTA', subtitle: 'Call', buttonText: 'Click', buttonLink: '/contact' },
        ...overrides,
      }
    }

    // ─── Edit seeded entry preserving IDs ─────────────────────────────
    console.log('\n--- Edit seeded entry (Vanda) preserving 5 others ---')
    const vandaId = seededFlowers?.[0]?.id

    await payload.updateGlobal({
      slug: 'homepage',
      data: fullHomepageData({
        realFlowers: {
          title: 'Flores Verdadeiras',
          subtitle: 'Beleza natural',
          flowers: [
            { id: vandaId, name: 'Vanda Editada 1', scientificName: 'Vanda coerulea' },
            { id: seededFlowers?.[1]?.id, name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio' },
            { id: seededFlowers?.[2]?.id, name: 'Sobrália', scientificName: 'Sobralia rosea' },
            { id: seededFlowers?.[3]?.id, name: 'Cambria', scientificName: 'Cambria Africana' },
            { id: seededFlowers?.[4]?.id, name: 'Laelia', scientificName: 'Laelia purpurata' },
            { id: seededFlowers?.[5]?.id, name: 'Cattleya', scientificName: 'Cattleya spp.' },
          ],
        },
      }),
      locale: 'pt',
    } as any)

    const hpAfterEdit1 = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    const after1 = hpAfterEdit1.realFlowers?.flowers
    assert(after1?.length === 6, 'Still 6 flowers after edit')
    assert(after1?.[0]?.name === 'Vanda Editada 1', 'Vanda name changed to "Vanda Editada 1"')
    assert(after1?.[0]?.id === vandaId, 'Vanda ID preserved')
    assert(after1?.[1]?.name === 'Paphiopedilum', 'Paphiopedilum preserved')
    assert(after1?.[2]?.name === 'Sobrália', 'Sobrália preserved')

    // ─── Second edit on same seeded entry ─────────────────────────────
    console.log('\n--- Second edit on same entry ---')
    await payload.updateGlobal({
      slug: 'homepage',
      data: fullHomepageData({
        realFlowers: {
          title: 'Flores Verdadeiras',
          subtitle: 'Beleza natural',
          flowers: [
            { id: vandaId, name: 'Vanda Editada 2', scientificName: 'Vanda coerulea' },
            { id: seededFlowers?.[1]?.id, name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio' },
            { id: seededFlowers?.[2]?.id, name: 'Sobrália', scientificName: 'Sobralia rosea' },
            { id: seededFlowers?.[3]?.id, name: 'Cambria', scientificName: 'Cambria Africana' },
            { id: seededFlowers?.[4]?.id, name: 'Laelia', scientificName: 'Laelia purpurata' },
            { id: seededFlowers?.[5]?.id, name: 'Cattleya', scientificName: 'Cattleya spp.' },
          ],
        },
      }),
      locale: 'pt',
    } as any)

    const hpAfterEdit2 = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    const after2 = hpAfterEdit2.realFlowers?.flowers
    assert(after2?.[0]?.name === 'Vanda Editada 2', 'Second edit persisted: "Vanda Editada 2"')
    assert(after2?.[0]?.id === vandaId, 'Vanda ID preserved after second edit')
    assert(after2?.length === 6, 'Still 6 after second edit')

    // ─── FINDING 3: Real Media relationship ───────────────────────────
    console.log('\n═══════════════════════════════════════')
    console.log(' FINDING 3 — Real Media relationship')
    console.log('═══════════════════════════════════════')

    // Create a real Media entry
    // We need a minimal file to upload. Since we can't create a real file,
    // we create a text file and upload it as media
    const fs = require('fs')
    const path = require('path')
    const os = require('os')

    const testImgPath = path.join(os.tmpdir(), 'test-flower-media.txt')
    fs.writeFileSync(testImgPath, 'test content for media upload')

    const mediaDoc = await payload.create({
      collection: 'media',
      data: { alt: 'Test Flower Image' },
      filePath: testImgPath,
      mimeType: 'text/plain',
    } as any)

    assert(mediaDoc?.id !== undefined, 'Media entry created with id')
    console.log('  Media ID:', mediaDoc.id)

    // Clean up temp file
    try { fs.unlinkSync(testImgPath) } catch {}

    // Associate the Media with the Vanda flower
    await payload.updateGlobal({
      slug: 'homepage',
      data: fullHomepageData({
        realFlowers: {
          title: 'Flores Verdadeiras',
          subtitle: 'Beleza natural',
          flowers: [
            { id: vandaId, name: 'Vanda Editada 2', scientificName: 'Vanda coerulea', image: mediaDoc.id },
            { id: seededFlowers?.[1]?.id, name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio' },
            { id: seededFlowers?.[2]?.id, name: 'Sobrália', scientificName: 'Sobralia rosea' },
            { id: seededFlowers?.[3]?.id, name: 'Cambria', scientificName: 'Cambria Africana' },
            { id: seededFlowers?.[4]?.id, name: 'Laelia', scientificName: 'Laelia purpurata' },
            { id: seededFlowers?.[5]?.id, name: 'Cattleya', scientificName: 'Cattleya spp.' },
          ],
        },
      }),
      locale: 'pt',
    } as any)

    // Readback with depth to resolve the relationship
    const hpMedia = await payload.findGlobal({ slug: 'homepage', locale: 'pt', depth: 1 })
    const mediaFlower = hpMedia.realFlowers?.flowers?.[0] as
      | { id?: string | null; name: string; scientificName: string; image?: { url?: string | null } | number | null }
      | undefined
    assert(mediaFlower !== undefined, 'Flower exists after media association')
    assert('image' in mediaFlower!, 'image field exists')
    // The image should be resolved as an object with url (since depth=1)
    const img = mediaFlower!.image
    assert(typeof img === 'object' && img !== null && !Array.isArray(img), 'Image resolved to object (not number)')
    if (typeof img === 'object' && img !== null) {
      assert('url' in img, 'Resolved image has url property')
      assert(typeof (img as any).url === 'string' && (img as any).url.length > 0, 'image.url is non-empty string')
    }

    // ─── Test 1: Save Homepage with 1 flower (PT) ──────────────────
    console.log('\n--- Test 1: Save homepage with 1 flower (PT) ---')
    // Replace all flowers with a single new one
    await payload.updateGlobal({
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
    assert(flowerId !== undefined, 'Flower ID is defined')

    // ─── Test 2: Update name in EN locale ──────────────────────────
    console.log('\n--- Test 2: Update name in EN locale ---')
    await payload.updateGlobal({
      slug: 'homepage',
      data: fullHomepageData({
        realFlowers: {
          title: 'Flores Verdadeiras',
          subtitle: 'Beleza natural',
          flowers: flowerId ? [
            { id: flowerId, name: 'Vanda Orchid', scientificName: 'Vanda coerulea' },
          ] : [],
        },
      }),
      locale: 'en',
    } as any)

    const hpEn = await payload.findGlobal({ slug: 'homepage', locale: 'en' })
    const hpPtAfter = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert(hpEn.realFlowers?.flowers?.[0]?.name === 'Vanda Orchid', 'EN name is Vanda Orchid')
    assert(hpPtAfter.realFlowers?.flowers?.[0]?.name === 'Orquídea Vanda', 'PT preserved after EN write')

    // ─── Test 3: Array with 7 flowers ──────────────────────────────
    console.log('\n--- Test 3: Array with 7 flowers ---')
    const seven = Array.from({ length: 7 }, (_, i) => ({
      name: `Flor ${i + 1}`,
      scientificName: `Spec${i + 1}`,
    }))
    await payload.updateGlobal({
      slug: 'homepage',
      data: fullHomepageData({ realFlowers: { title: 'Flores', flowers: seven } }),
      locale: 'pt',
    } as any)
    const hp7 = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert(hp7.realFlowers?.flowers?.length === 7, '7 flowers in array')

    // ─── Test 4: Array with 12 flowers ─────────────────────────────
    console.log('\n--- Test 4: Array with 12 flowers (no maxRows) ---')
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      name: `Flor ${i + 1}`,
      scientificName: `Spec${i + 1}`,
    }))
    await payload.updateGlobal({
      slug: 'homepage',
      data: fullHomepageData({ realFlowers: { title: 'Flores', flowers: twelve } }),
      locale: 'pt',
    } as any)
    const hp12 = await payload.findGlobal({ slug: 'homepage', locale: 'pt' })
    assert(hp12.realFlowers?.flowers?.length === 12, '12 flowers (no maxRows)')

    // ─── Test 5: Verify DB structure ───────────────────────────────
    console.log('\n--- Test 5: Verify DB structure ---')
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