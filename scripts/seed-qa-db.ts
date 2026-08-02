/**
 * E6F QA — Cria base de teste completa com schema atual, fixtures PT e traduções.
 * Usa Payload Local API. Zero alterações a loja.sqlite.
 */
import { getPayload, initTransaction, commitTransaction } from 'payload'
import { createHash } from 'crypto'
import config from '../src/payload.config.js'
import { readFileSync, existsSync } from 'fs'

const sh = (t: string) => 'sha256:' + createHash('sha256').update(t).digest('hex').slice(0, 12)
const SPIKE = new URL('..', import.meta.url).pathname
const MF = (f: string) => JSON.parse(readFileSync(`${SPIKE}translations/${f}.json`, 'utf-8'))

async function main() {
  const payload = await getPayload({ config })

  // Load manifests
  const hp = MF('homepage')
  const cat = MF('categories')
  const col = MF('collections')
  const fl = MF('flowers')
  let err = 0

  // Validate 68 sourceHash
  for (const [label, data] of [['homepage', hp], ['categories', cat], ['collections', col], ['flowers', fl]] as const) {
    for (const [key, entry] of Object.entries(data.fields) as any) {
      const h = sh((entry as any).source)
      if (h !== (entry as any).sourceHash) { console.error(`❌ ${label}/${key}: hash mismatch ${h} vs ${(entry as any).sourceHash}`); err++ }
    }
  }
  if (err > 0) { console.error(`\n❌ ${err} hash errors`); process.exit(1) }
  console.log('✅ 68/68 sourceHash valid')

  // Homepage
  const hpData: any = {
    hero: { heroTitle: '', heroSubtitle: '', primaryButtonText: '', secondaryButtonText: '', primaryButtonLink: '/catalog', secondaryButtonLink: '/catalog' },
    realFlowers: { title: '', subtitle: '' },
    story: { title: '', text: '', image: undefined },
    international: { title: '', subtitle: '' },
    instagram: { title: '', text: '', handle: 'eternal.flowers.pt' },
    cta: { title: '', subtitle: '', buttonText: '', buttonLink: '/catalog' },
    footer: { brandDescription: '', email: 'loja@eternalflowers.pt', phone: '+351999999999', instagramUrl: 'https://instagram.com/eternal.flowers.pt', whatsappUrl: 'https://wa.me/351999999999' },
  }
  for (const [key, entry] of Object.entries(hp.fields) as any) {
    const [grp, fld] = (key as string).split('.')
    hpData[grp][fld] = (entry as any).source
  }
  await payload.updateGlobal({ slug: 'homepage', data: hpData })
  console.log('✅ Homepage seeded')

  // Categories
  const catData: Record<string, any> = {}
  for (const [key, entry] of Object.entries(cat.fields) as any) {
    const slug = (key as string).split('.')[0]
    const fn = (key as string).split('.')[1]
    if (!catData[slug]) catData[slug] = { slug, name: '', description: '' }
    catData[slug][fn] = (entry as any).source
  }
  for (const data of Object.values(catData)) {
    const all = await payload.find({ collection: 'categories', limit: 100 })
    const match = (all.docs as any[]).find((d: any) => d.slug === data.slug)
    if (!match) await payload.create({ collection: 'categories', data })
    else await payload.update({ collection: 'categories', id: match.id, data })
  }
  console.log(`✅ ${Object.keys(catData).length} Categories seeded`)

  // Collections
  const REAL_COL_SLUGS: Record<string, string> = { 'classica': 'casamentos', 'essencial': 'dia-da-mae', 'linha-noiva': 'edicao-limitada', 'presente': 'memorias', 'ceu-estrelado': 'natureza', 'colecao-verao': 'primavera' }
  const colData: Record<string, any> = {}
  for (const [key, entry] of Object.entries(col.fields) as any) {
    const keySlug = (key as string).split('.')[0]
    const fn = (key as string).split('.')[1]
    const slug = REAL_COL_SLUGS[keySlug] || keySlug
    if (!colData[slug]) colData[slug] = { slug, name: '', description: '', isActive: true }
    colData[slug][fn] = (entry as any).source
  }
  for (const data of Object.values(colData)) {
    const all = await payload.find({ collection: 'collections', limit: 100 })
    const match = (all.docs as any[]).find((d: any) => d.slug === data.slug)
    if (!match) await payload.create({ collection: 'collections', data })
    else await payload.update({ collection: 'collections', id: match.id, data })
  }
  console.log(`✅ ${Object.keys(colData).length} Collections seeded`)

  // Get cat/col IDs for relations
  const allCats = (await payload.find({ collection: 'categories', limit: 100 })).docs
  const allCols = (await payload.find({ collection: 'collections', limit: 100 })).docs
  const catMap: Record<string, number> = {}
  const colMap: Record<string, number> = {}
  for (const c of allCats as any[]) catMap[c.slug] = c.id
  for (const c of allCols as any[]) colMap[c.slug] = c.id

  // Flower category/collection relations (from original db data)
  const flowerCat: Record<string, string> = { '1': 'colares', '2': 'brincos', '3': 'pulseiras', '4': 'porta-chaves', '5': 'molduras', '6': 'colares', '7': 'brincos', '8': 'pulseiras', '9': 'porta-chaves', '10': 'molduras' }
  const flowerCols: Record<string, string[]> = { '1': ['classica', 'essencial', 'presente'], '2': ['presente', 'essencial'], '3': ['classica', 'presente'], '4': ['presente'], '5': ['essencial', 'classica', 'presente'], '6': ['essencial', 'presente'], '7': ['presente'], '8': ['classica', 'presente'], '9': ['presente'], '10': ['essencial', 'presente'] }

  // Flowers
  const flData: Record<number, any> = {}
  for (const [key, entry] of Object.entries(fl.fields) as any) {
    const id = parseInt((key as string).split('-')[1].split('.')[0], 10)
    const fn = (key as string).split('.')[1]
    if (!flData[id]) flData[id] = {}
    flData[id][fn] = (entry as any).source
  }
  for (const [id, fields] of Object.entries(flData)) {
    const slug = 'flower-' + id
    const catSlug = flowerCat[id] || 'colares'
    const colSlugs = flowerCols[id] || ['presente']
    const data: any = {
      slug,
      namePt: (fields as any).name || '',
      nameEn: '', nameEs: '', nameIt: '', nameDe: '',
      descriptionPt: (fields as any).description || '',
      descriptionEn: '', descriptionEs: '', descriptionIt: '', descriptionDe: '',
      story: (fields as any).story || '',
      productType: 'permanente',
      scientificName: 'Test',
      creationName: '',
      price: 49.90,
      stock: 10,
      sku: slug,
      category: catMap[catSlug] || null,
      collections: colSlugs.map((s: string) => colMap[s]).filter(Boolean),
      availability: 'available',
    }
    const all = await payload.find({ collection: 'flowers', limit: 100 })
    const match = (all.docs as any[]).find((d: any) => d.sku === slug || d.namePt === (fields as any).name)
    if (!match) await payload.create({ collection: 'flowers', data })
    else await payload.update({ collection: 'flowers', id: match.id, data })
  }
  console.log(`✅ ${Object.keys(flData).length} Flowers seeded`)

  console.log('\n✅ QA database seeded. Ready for translation import.')
  process.exit(0)
}

main()