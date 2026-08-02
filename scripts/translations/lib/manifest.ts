const MANIFEST_FILES = [
  'homepage',
  'categories',
  'collections',
  'flowers',
] as const
type Entity = typeof MANIFEST_FILES[number]

interface TranslationEntry {
  required: boolean
  source: string
  sourceHash: string
  translations: Record<string, { value: string; status: string; notes: string }>
}

interface Manifest {
  version: number
  entity: string
  slug: string
  sourceLocale: string
  targetLocales: string[]
  fields: Record<string, TranslationEntry>
}

export interface ValidationResult {
  entity: Entity
  valid: boolean
  fieldCount: number
  translationCount: number
  errors: string[]
}

export interface MirrorCheck {
  entity: Entity
  matched: boolean
  diffs: string[]
}

export interface Source {
  entity: Entity
  field: string
  source: string
  hash: string
}

/**
 * Validate a manifest JSON structure and return field/slug counts.
 */
export function validateManifest(data: any, entity: Entity): ValidationResult {
  const errors: string[] = []
  const fields = data?.fields
  if (!fields || typeof fields !== 'object') {
    return { entity, valid: false, fieldCount: 0, translationCount: 0, errors: ['fields missing or not an object'] }
  }

  const fieldPaths = Object.keys(fields)

  // Version
  if (data.version !== 1) errors.push('version must be 1')
  if (data.entity !== 'global' && data.entity !== entity) errors.push(`entity mismatch: ${data.entity}`)
  if (data.sourceLocale !== 'pt') errors.push('sourceLocale must be pt')
  if (!['en', 'es', 'it', 'de'].every(l => data.targetLocales?.includes(l))) errors.push('targetLocales must include en, es, it, de')
  if (data.targetLocales?.length !== 4) errors.push('exactly 4 targetLocales required')

  // Expected counts
  const expected = { homepage: 16, categories: 10, collections: 12, flowers: 30 }
  if (fieldPaths.length !== expected[entity]) errors.push(`expected ${expected[entity]} fields, got ${fieldPaths.length}`)

  // Content checks
  for (const path of fieldPaths) {
    const entry = fields[path]
    if (!entry.source) errors.push(`${path}: empty source`)
    if (!entry.sourceHash?.startsWith('sha256:')) errors.push(`${path}: invalid sourceHash format`)
    if (typeof entry.required !== 'boolean') errors.push(`${path}: required must be boolean`)

    for (const loc of (data.targetLocales || [])) {
      const t = entry.translations?.[loc]
      if (!t) errors.push(`${path}: missing translation for ${loc}`)
      else {
        if (!t.value) errors.push(`${path}/${loc}: empty translation`)
        if (t.status && !['ai-reviewed', 'draft', 'source-empty'].includes(t.status)) errors.push(`${path}/${loc}: invalid status ${t.status}`)
      }
    }
  }

  // Slug uniqueness for categories/collections/flowers
  if (['categories', 'collections', 'flowers'].includes(entity)) {
    const slugs = new Set(fieldPaths.map(p => p.split('.')[0]))
    const expectedSlugs = {
      categories: 5, collections: 6, flowers: 10
    }
    if (slugs.size !== expectedSlugs[entity as keyof typeof expectedSlugs]) errors.push(`expected ${expectedSlugs[entity as keyof typeof expectedSlugs]} slugs, got ${slugs.size}`)
  }

  const translations = fieldPaths.length * (data.targetLocales?.length || 0)
  return { entity, valid: errors.length === 0, fieldCount: fieldPaths.length, translationCount: translations, errors }
}

/**
 * Validate that per-locale mirror files match the aggregate.
 */
export function checkMirrors(aggregate: any, perLocale: any, entity: Entity, locale: string): MirrorCheck {
  const diffs: string[] = []
  const aggFields = aggregate?.fields || {}
  const locFields = perLocale?.fields || {}

  const allKeys = new Set([...Object.keys(aggFields), ...Object.keys(locFields)])
  for (const key of allKeys) {
    if (!aggFields[key]) { diffs.push(`${key}: missing in aggregate`); continue }
    if (!locFields[key]) { diffs.push(`${key}: missing in ${locale} file`); continue }
    if (aggFields[key].source !== locFields[key].source) diffs.push(`${key}: source mismatch`)
    if (aggFields[key].sourceHash !== locFields[key].sourceHash) diffs.push(`${key}: sourceHash mismatch`)
    if (aggFields[key]?.translations?.[locale]?.value !== locFields[key]?.translations?.[locale]?.value) diffs.push(`${key}: translation value mismatch for ${locale}`)
  }
  return { entity, matched: diffs.length === 0, diffs }
}

/**
 * Load and validate all manifest files.
 */
export function loadAndValidateAllManifests(fs: any, path: any, baseDir: string) {
  const results: ValidationResult[] = []
  const sources: Source[] = []
  const manifests: Record<string, any> = {}

  for (const entity of MANIFEST_FILES) {
    const filePath = path.join(baseDir, `${entity}.json`)
    if (!fs.existsSync(filePath)) {
      results.push({ entity, valid: false, fieldCount: 0, translationCount: 0, errors: ['file not found'] })
      continue
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    manifests[entity] = data
    const vr = validateManifest(data, entity)
    results.push(vr)
    if (vr.valid) {
      for (const [fieldPath, entry] of Object.entries(data.fields) as [string, TranslationEntry][]) {
        sources.push({ entity, field: fieldPath, source: entry.source, hash: entry.sourceHash })
      }
    }
  }
  return { results, sources, manifests }
}