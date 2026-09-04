/**
 * catalog-assistant.ts — Catalog Assistant API Service
 *
 * Camada protegida entre a API externa (ChatGPT Actions) e o Payload Local API.
 *
 * Princípios de segurança:
 *   1. Allowlists explícitas por recurso — NUNCA passa req.body diretamente ao Payload.
 *   2. isPublic/isActive são forçados a false pelo servidor — o cliente NUNCA pode publicar.
 *   3. Campos fora da allowlist são rejeitados com 400.
 *   4. Autenticação por Bearer token comparado em constant-time.
 *   5. Nenhum acesso a orders, payments, users, homepage, site-settings, coupons, stock-reservations.
 */

import { getPayloadClient } from '@/payload'
import type { Payload, PayloadRequest } from 'payload'

// ─── Constantes ──────────────────────────────────────────────

export const CATALOG_ASSISTANT_API_KEY_ENV = 'CATALOG_ASSISTANT_API_KEY'

// ─── Tipos de resposta ───────────────────────────────────────

type SuccessResponse<T> = { success: true; data: T }
type ErrorResponse = { success: false; error: { code: string; message: string } }

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

function success<T>(data: T, status = 200): Response {
  const body: SuccessResponse<T> = { success: true, data }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function error(code: string, message: string, status: number): Response {
  // NUNCA expor stack traces, secrets, ou detalhes internos
  const body: ErrorResponse = { success: false, error: { code, message } }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Const-time string comparison ────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ─── Autenticação ────────────────────────────────────────────

/**
 * Extrai e valida o Bearer token do header Authorization.
 * Usa comparação constant-time para evitar timing attacks.
 */
function validateAuth(request: Request): boolean {
  const header = request.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return false

  const token = header.slice('Bearer '.length).trim()
  if (!token) return false

  const expected = process.env[CATALOG_ASSISTANT_API_KEY_ENV]
  if (!expected) {
    // Chave não configurada — negar acesso por segurança
    console.error('[catalog-assistant] API key not configured in environment')
    return false
  }

  return safeCompare(token, expected)
}

// ─── Allowlists ──────────────────────────────────────────────

/**
 * Campos permitidos para produtos (flowers).
 * NUNCA incluir: id, createdAt, updatedAt, _status, isPublic (force false),
 * ou qualquer campo de sistema/pagamento/checkout.
 */
const FLOWER_ALLOWLIST = new Set([
  'namePt',
  'nameEn',
  'nameEs',
  'nameIt',
  'nameDe',
  'productType',
  'scientificName',
  'creationName',
  'price',
  'descriptionPt',
  'descriptionEn',
  'descriptionEs',
  'descriptionIt',
  'descriptionDe',
  'image',
  'availability',
  'sku',
  'images',
  'productionMode',
  'productionLeadTime',
  'stockQuantity',
  'shippingClass',
  'canShareShippingPackage',
  'story',
  'category',
  'collections',
])

/** Campos proibidos que nunca devem ser enviados (rejeitar com 400). */
const FLOWER_BLOCKED = new Set([
  'id',
  'createdAt',
  'updatedAt',
  '_status',
  'password',
  'role',
  'email',
  'orderStatus',
  'paymentStatus',
  'stripePaymentIntentId',
  'stripeRefundId',
  'checkoutRequestHash',
  'checkoutAttemptId',
])

/**
 * Campos permitidos para categorias.
 * Campos de sistema (id, createdAt, etc.) são rejeitados.
 * isActive é force false — nunca aceitar.
 */
const CATEGORY_ALLOWLIST = new Set([
  'translations',
  'slug',
  'sortOrder',
])

/** Campos de sistema proibidos para categorias. */
const CATEGORY_BLOCKED = new Set([
  'id',
  'createdAt',
  'updatedAt',
  '_status',
  'password',
  'role',
  'email',
])

/** Campos de tradução permitidos para categorias/coleções (sub-campos de 'translations'). */
const LOCALIZED_ALLOWLIST = new Set([
  'name',
  'description',
])

const CATEGORY_LOCALE_KEYS = new Set(['pt', 'en', 'es', 'it', 'de'])

/**
 * Campos permitidos para coleções.
 */
const COLLECTION_ALLOWLIST = new Set([
  'translations',
  'slug',
])

const COLLECTION_BLOCKED = new Set([
  'id',
  'createdAt',
  'updatedAt',
  '_status',
  'password',
  'role',
  'email',
])

const COLLECTION_LOCALE_KEYS = new Set(['pt', 'en', 'es', 'it', 'de'])

// ─── Filtragem de campos ─────────────────────────────────────

interface FieldFilterResult {
  cleaned: Record<string, unknown>
  errors: string[]
}

/**
 * Filtra campos de um produto (flowers) contra a allowlist.
 * Rejeita campos proibidos e desconhecidos.
 * Remove explicitamente isPublic se for enviado (silenciosamente).
 */
function filterFlowerFields(body: Record<string, unknown>): FieldFilterResult {
  const cleaned: Record<string, unknown> = {}
  const errors: string[] = []

  for (const [key] of Object.entries(body)) {
    if (FLOWER_BLOCKED.has(key)) {
      errors.push(`Campo proibido: "${key}"`)
      continue
    }
    if (key === 'isPublic') {
      // isPublic é controlado pelo servidor — silenciosamente removido
      continue
    }
    if (!FLOWER_ALLOWLIST.has(key)) {
      errors.push(`Campo desconhecido: "${key}"`)
      continue
    }
    cleaned[key] = body[key]
  }

  return { cleaned, errors }
}

/**
 * Filtra campos de categoria contra a allowlist.
 * Aceita formato 'translations' com locales pt/en/es/it/de.
 */
function filterCategoryFields(body: Record<string, unknown>): FieldFilterResult {
  const cleaned: Record<string, unknown> = {}
  const errors: string[] = []

  for (const [key, value] of Object.entries(body)) {
    if (CATEGORY_BLOCKED.has(key)) {
      errors.push(`Campo proibido: "${key}"`)
      continue
    }
    if (key === 'isActive') {
      // isActive é controlado pelo servidor — silenciosamente removido
      continue
    }
    if (key === 'translations') {
      // Validar estrutura de traduções
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push('"translations" deve ser um objeto com chaves de locale (pt, en, es, it, de)')
        continue
      }
      const trans = value as Record<string, unknown>
      const validTrans: Record<string, Record<string, unknown>> = {}

      for (const [locale, fields] of Object.entries(trans)) {
        if (!CATEGORY_LOCALE_KEYS.has(locale)) {
          errors.push(`Locale desconhecido em translations: "${locale}"`)
          continue
        }
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
          errors.push(`Valor para locale "${locale}" deve ser um objeto`)
          continue
        }
        const localeFields = fields as Record<string, unknown>
        const cleanedLocale: Record<string, unknown> = {}

        for (const [fieldName, fieldValue] of Object.entries(localeFields)) {
          if (!LOCALIZED_ALLOWLIST.has(fieldName)) {
            errors.push(`Campo desconhecido em translations.${locale}: "${fieldName}"`)
            continue
          }
          cleanedLocale[fieldName] = fieldValue
        }

        if (Object.keys(cleanedLocale).length > 0) {
          validTrans[locale] = cleanedLocale
        }
      }

      if (Object.keys(validTrans).length > 0) {
        cleaned['translations'] = validTrans
      }
      continue
    }
    if (!CATEGORY_ALLOWLIST.has(key)) {
      errors.push(`Campo desconhecido: "${key}"`)
      continue
    }
    cleaned[key] = body[key]
  }

  return { cleaned, errors }
}

/**
 * Filtra campos de coleção contra a allowlist.
 */
function filterCollectionFields(body: Record<string, unknown>): FieldFilterResult {
  const cleaned: Record<string, unknown> = {}
  const errors: string[] = []

  for (const [key, value] of Object.entries(body)) {
    if (COLLECTION_BLOCKED.has(key)) {
      errors.push(`Campo proibido: "${key}"`)
      continue
    }
    if (key === 'isActive') {
      // isActive é controlado pelo servidor — silenciosamente removido
      continue
    }
    if (key === 'translations') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push('"translations" deve ser um objeto com chaves de locale (pt, en, es, it, de)')
        continue
      }
      const trans = value as Record<string, unknown>
      const validTrans: Record<string, Record<string, unknown>> = {}

      for (const [locale, fields] of Object.entries(trans)) {
        if (!COLLECTION_LOCALE_KEYS.has(locale)) {
          errors.push(`Locale desconhecido em translations: "${locale}"`)
          continue
        }
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
          errors.push(`Valor para locale "${locale}" deve ser um objeto`)
          continue
        }
        const localeFields = fields as Record<string, unknown>
        const cleanedLocale: Record<string, unknown> = {}

        for (const [fieldName, fieldValue] of Object.entries(localeFields)) {
          if (!LOCALIZED_ALLOWLIST.has(fieldName)) {
            errors.push(`Campo desconhecido em translations.${locale}: "${fieldName}"`)
            continue
          }
          cleanedLocale[fieldName] = fieldValue
        }

        if (Object.keys(cleanedLocale).length > 0) {
          validTrans[locale] = cleanedLocale
        }
      }

      if (Object.keys(validTrans).length > 0) {
        cleaned['translations'] = validTrans
      }
      continue
    }
    if (!COLLECTION_ALLOWLIST.has(key)) {
      errors.push(`Campo desconhecido: "${key}"`)
      continue
    }
    cleaned[key] = body[key]
  }

  return { cleaned, errors }
}

// ─── Helpers de Payload Local API ────────────────────────────

/**
 * Aplica traduções a um documento categorias/coleções.
 * Cria primeiro no locale default, depois atualiza para cada locale adicional.
 */
async function applyLocalizedTranslations(
  payload: Payload,
  collection: 'categories' | 'collections',
  id: number | string,
  translations: Record<string, Record<string, unknown>>,
): Promise<void> {
  for (const [locale, fields] of Object.entries(translations)) {
    await payload.update({
      collection,
      id,
      data: fields as any,
      locale: locale as any,
      depth: 0,
    })
  }
}

/**
 * Constrói o data inicial para criação de um documento categorias/coleções.
 * Usa o locale pt como base (obrigatório, pois name é unique).
 */
function buildLocalizedBaseData(
  collection: 'categories' | 'collections',
  translations: Record<string, Record<string, unknown>> | undefined,
  otherFields: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...otherFields }

  if (translations && translations['pt']) {
    const ptFields = translations['pt']
    if (ptFields['name']) base['name'] = ptFields['name']
    if (ptFields['description']) base['description'] = ptFields['description']
  } else if (translations) {
    // Fallback para o primeiro locale disponível
    const firstLocale = Object.keys(translations)[0]
    if (firstLocale && translations[firstLocale]) {
      const firstFields = translations[firstLocale]
      if (firstFields['name']) base['name'] = firstFields['name']
      if (firstFields['description']) base['description'] = firstFields['description']
    }
  }

  return base
}

// ─── Operações CRUD ──────────────────────────────────────────

/**
 * GET /api/catalog-assistant/products
 */
export async function listProducts(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const search = url.searchParams.get('search') || ''
    const sku = url.searchParams.get('sku') || ''

    const payload = await getPayloadClient()

    const where: Record<string, unknown> = {}

    if (search) {
      where.or = [
        { namePt: { contains: search } },
        { nameEn: { contains: search } },
        { nameEs: { contains: search } },
        { nameIt: { contains: search } },
        { nameDe: { contains: search } },
        { sku: { contains: search } },
        { scientificName: { contains: search } },
        { creationName: { contains: search } },
      ]
    }

    if (sku) {
      where.sku = { equals: sku }
    }

    const result = await payload.find({
      collection: 'flowers',
      page,
      limit,
      where: where as any,
      depth: 1,
      locale: 'all' as any,
    })

    return success({
      docs: result.docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    })
  } catch (err: any) {
    console.error('[catalog-assistant] listProducts error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao listar produtos.', 500)
  }
}

/**
 * GET /api/catalog-assistant/products/:id
 */
export async function getProduct(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const payload = await getPayloadClient()
    const doc = await payload.findByID({
      collection: 'flowers',
      id: id as any,
      depth: 1,
      locale: 'all' as any,
    })
    return success(doc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Produto não encontrado.', 404)
    }
    console.error('[catalog-assistant] getProduct error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao consultar produto.', 500)
  }
}

/**
 * POST /api/catalog-assistant/products
 */
export async function createProduct(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const body: Record<string, unknown> = await req.json()
    const { cleaned, errors: fieldErrors } = filterFlowerFields(body)

    if (fieldErrors.length > 0) {
      return error('INVALID_FIELD', `Campos inválidos: ${fieldErrors.join('; ')}`, 400)
    }

    // Forçar isPublic = false
    cleaned.isPublic = false

    const payload = await getPayloadClient()
    const doc = await payload.create({
      collection: 'flowers',
      data: cleaned as any,
      depth: 1,
    })

    return success(doc, 201)
  } catch (err: any) {
    if (err.name === 'ValidationError' || err.message?.startsWith('The following field')) {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    if (err.message?.includes('O email é obrigatório') || err.message?.includes('Modo de Produção')) {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    console.error('[catalog-assistant] createProduct error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao criar produto.', 500)
  }
}

/**
 * PATCH /api/catalog-assistant/products/:id
 */
export async function updateProduct(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const body: Record<string, unknown> = await req.json()
    const { cleaned, errors: fieldErrors } = filterFlowerFields(body)

    if (fieldErrors.length > 0) {
      return error('INVALID_FIELD', `Campos inválidos: ${fieldErrors.join('; ')}`, 400)
    }

    // Forçar isPublic = false (mesmo que o registo estivesse público)
    cleaned.isPublic = false

    const payload = await getPayloadClient()
    const doc = await payload.update({
      collection: 'flowers',
      id: id as any,
      data: cleaned as any,
      depth: 1,
    })

    return success(doc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Produto não encontrado.', 404)
    }
    if (err.name === 'ValidationError' || err.message?.startsWith('The following field')) {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    if (err.message?.includes('Modo de Produção')) {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    console.error('[catalog-assistant] updateProduct error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao atualizar produto.', 500)
  }
}

// ─── Categories ──────────────────────────────────────────────

export async function listCategories(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const search = url.searchParams.get('search') || ''

    const payload = await getPayloadClient()

    const where: Record<string, unknown> = {}
    if (search) {
      where.name = { contains: search }
    }

    const result = await payload.find({
      collection: 'categories',
      page,
      limit,
      where: where as any,
      depth: 1,
      locale: 'all' as any,
    })

    return success({
      docs: result.docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    })
  } catch (err: any) {
    console.error('[catalog-assistant] listCategories error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao listar categorias.', 500)
  }
}

export async function getCategory(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const payload = await getPayloadClient()
    const doc = await payload.findByID({
      collection: 'categories',
      id: id as any,
      depth: 1,
      locale: 'all' as any,
    })
    return success(doc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Categoria não encontrada.', 404)
    }
    console.error('[catalog-assistant] getCategory error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao consultar categoria.', 500)
  }
}

export async function createCategory(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const body: Record<string, unknown> = await req.json()
    const { cleaned, errors: fieldErrors } = filterCategoryFields(body)

    if (fieldErrors.length > 0) {
      return error('INVALID_FIELD', `Campos inválidos: ${fieldErrors.join('; ')}`, 400)
    }

    // isActive = false forçado pelo servidor
    cleaned.isActive = false

    const translations = cleaned['translations'] as Record<string, Record<string, unknown>> | undefined
    delete cleaned['translations']

    const payload = await getPayloadClient()

    // Construir data base a partir das traduções pt (default locale)
    const baseData = buildLocalizedBaseData('categories', translations, cleaned)
    const doc = await payload.create({
      collection: 'categories',
      data: baseData as any,
      depth: 0,
    })

    // Aplicar traduções para outros locales
    if (translations) {
      await applyLocalizedTranslations(payload, 'categories', doc.id, translations)
    }

    // Re-buscar com depth para incluir relações (best-effort)
    try {
      const fullDoc = await payload.findByID({
        collection: 'categories',
        id: doc.id,
        depth: 1,
        locale: 'all' as any,
      })
      return success(fullDoc, 201)
    } catch {
      // Fallback: devolver o documento criado (sem relações populadas)
      return success(doc, 201)
    }
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.message?.includes('NotFound')) {
      return error('NOT_FOUND', 'Categoria não encontrada após criação.', 404)
    }
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return error('CONFLICT', 'Já existe uma categoria com este nome ou slug.', 409)
    }
    if (err.name === 'ValidationError') {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    console.error('[catalog-assistant] createCategory error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao criar categoria.', 500)
  }
}

export async function updateCategory(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const body: Record<string, unknown> = await req.json()
    const { cleaned, errors: fieldErrors } = filterCategoryFields(body)

    if (fieldErrors.length > 0) {
      return error('INVALID_FIELD', `Campos inválidos: ${fieldErrors.join('; ')}`, 400)
    }

    // isActive = false forçado
    cleaned.isActive = false

    const translations = cleaned['translations'] as Record<string, Record<string, unknown>> | undefined
    delete cleaned['translations']

    const payload = await getPayloadClient()

    // Atualizar dados base (locale pt)
    if (Object.keys(cleaned).length > 0) {
      await payload.update({
        collection: 'categories',
        id: id as any,
        data: cleaned as any,
        depth: 0,
      })
    }

    // Aplicar traduções para todos os locales
    if (translations) {
      await applyLocalizedTranslations(payload, 'categories', id, translations)
    }

    const fullDoc = await payload.findByID({
      collection: 'categories',
      id: id as any,
      depth: 1,
      locale: 'all' as any,
    })

    return success(fullDoc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Categoria não encontrada.', 404)
    }
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return error('CONFLICT', 'Já existe uma categoria com este nome ou slug.', 409)
    }
    if (err.name === 'ValidationError') {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    console.error('[catalog-assistant] updateCategory error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao atualizar categoria.', 500)
  }
}

// ─── Collections ─────────────────────────────────────────────

export async function listCollections(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const search = url.searchParams.get('search') || ''

    const payload = await getPayloadClient()

    const where: Record<string, unknown> = {}
    if (search) {
      where.name = { contains: search }
    }

    const result = await payload.find({
      collection: 'collections',
      page,
      limit,
      where: where as any,
      depth: 1,
      locale: 'all' as any,
    })

    return success({
      docs: result.docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    })
  } catch (err: any) {
    console.error('[catalog-assistant] listCollections error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao listar coleções.', 500)
  }
}

export async function getCollection(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const payload = await getPayloadClient()
    const doc = await payload.findByID({
      collection: 'collections',
      id: id as any,
      depth: 1,
      locale: 'all' as any,
    })
    return success(doc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Coleção não encontrada.', 404)
    }
    console.error('[catalog-assistant] getCollection error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao consultar coleção.', 500)
  }
}

export async function createCollection(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const body: Record<string, unknown> = await req.json()
    const { cleaned, errors: fieldErrors } = filterCollectionFields(body)

    if (fieldErrors.length > 0) {
      return error('INVALID_FIELD', `Campos inválidos: ${fieldErrors.join('; ')}`, 400)
    }

    // isActive = false forçado
    cleaned.isActive = false

    const translations = cleaned['translations'] as Record<string, Record<string, unknown>> | undefined
    delete cleaned['translations']

    const payload = await getPayloadClient()

    const baseData = buildLocalizedBaseData('collections', translations, cleaned)
    const doc = await payload.create({
      collection: 'collections',
      data: baseData as any,
      depth: 0,
    })

    if (translations) {
      await applyLocalizedTranslations(payload, 'collections', doc.id, translations)
    }

    // Re-buscar com depth para incluir relações (best-effort)
    try {
      const fullDoc = await payload.findByID({
        collection: 'collections',
        id: doc.id,
        depth: 1,
        locale: 'all' as any,
      })
      return success(fullDoc, 201)
    } catch {
      return success(doc, 201)
    }
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.message?.includes('NotFound')) {
      return error('NOT_FOUND', 'Coleção não encontrada após criação.', 404)
    }
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return error('CONFLICT', 'Já existe uma coleção com este nome ou slug.', 409)
    }
    if (err.name === 'ValidationError') {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    console.error('[catalog-assistant] createCollection error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao criar coleção.', 500)
  }
}

export async function updateCollection(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const body: Record<string, unknown> = await req.json()
    const { cleaned, errors: fieldErrors } = filterCollectionFields(body)

    if (fieldErrors.length > 0) {
      return error('INVALID_FIELD', `Campos inválidos: ${fieldErrors.join('; ')}`, 400)
    }

    // isActive = false forçado
    cleaned.isActive = false

    const translations = cleaned['translations'] as Record<string, Record<string, unknown>> | undefined
    delete cleaned['translations']

    const payload = await getPayloadClient()

    if (Object.keys(cleaned).length > 0) {
      await payload.update({
        collection: 'collections',
        id: id as any,
        data: cleaned as any,
        depth: 0,
      })
    }

    if (translations) {
      await applyLocalizedTranslations(payload, 'collections', id, translations)
    }

    const fullDoc = await payload.findByID({
      collection: 'collections',
      id: id as any,
      depth: 1,
      locale: 'all' as any,
    })

    return success(fullDoc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Coleção não encontrada.', 404)
    }
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return error('CONFLICT', 'Já existe uma coleção com este nome ou slug.', 409)
    }
    if (err.name === 'ValidationError') {
      return error('VALIDATION_ERROR', err.message, 400)
    }
    console.error('[catalog-assistant] updateCollection error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao atualizar coleção.', 500)
  }
}

// ─── Media ───────────────────────────────────────────────────

/** MIME types de imagem aceites para upload. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

/** Tamanho máximo de upload: 10 MB. */
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

export async function listMedia(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)

    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'media',
      page,
      limit,
      depth: 0,
    })

    return success({
      docs: result.docs,
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    })
  } catch (err: any) {
    console.error('[catalog-assistant] listMedia error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao listar media.', 500)
  }
}

export async function getMedia(req: Request, id: string): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const payload = await getPayloadClient()
    const doc = await payload.findByID({
      collection: 'media',
      id: id as any,
      depth: 0,
    })
    return success(doc)
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      return error('NOT_FOUND', 'Media não encontrada.', 404)
    }
    console.error('[catalog-assistant] getMedia error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao consultar media.', 500)
  }
}

/**
 * POST /api/catalog-assistant/media
 * Upload de ficheiro via multipart/form-data.
 */
export async function createMedia(req: Request): Promise<Response> {
  if (!validateAuth(req)) return error('UNAUTHORIZED', 'Token de acesso inválido ou ausente.', 401)

  try {
    const contentType = req.headers.get('Content-Type') || ''

    if (!contentType.includes('multipart/form-data')) {
      return error('INVALID_REQUEST', 'Media upload requer Content-Type: multipart/form-data.', 400)
    }

    const formData = await req.formData()
    const fileField = formData.get('file')

    if (!fileField || !(fileField instanceof File)) {
      return error('INVALID_REQUEST', 'Campo "file" é obrigatório e deve ser um ficheiro.', 400)
    }

    const file = fileField as File

    // Validar MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return error(
        'INVALID_MIME_TYPE',
        `Tipo de ficheiro não permitido: "${file.type}". ` +
        `Aceite: image/jpeg, image/png, image/webp.`,
        415,
      )
    }

    // Validar tamanho
    if (file.size > MAX_UPLOAD_SIZE) {
      return error(
        'FILE_TOO_LARGE',
        `Ficheiro demasiado grande: ${(file.size / (1024 * 1024)).toFixed(1)} MB. ` +
        `Máximo: ${MAX_UPLOAD_SIZE / (1024 * 1024)} MB.`,
        413,
      )
    }

    // Validar extensão
    const name = file.name.toLowerCase()
    const ext = name.split('.').pop()
    if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return error('INVALID_EXTENSION', `Extensão de ficheiro não permitida: .${ext}`, 415)
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const payload = await getPayloadClient()

    const doc = await payload.create({
      collection: 'media',
      data: {
        _key: file.name, // usado internamente pelo Payload como filename
      } as any,
      file: {
        data: buffer,
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
      depth: 0,
    })

    return success(doc, 201)
  } catch (err: any) {
    if (err.message?.includes('payload-files') || err.message?.includes('upload')) {
      return error('UPLOAD_ERROR', `Erro no upload: ${err.message}`, 500)
    }
    console.error('[catalog-assistant] createMedia error:', err.message)
    return error('INTERNAL_ERROR', 'Erro ao fazer upload de media.', 500)
  }
}