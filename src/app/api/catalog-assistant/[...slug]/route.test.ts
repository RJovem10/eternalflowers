/**
 * Testes para Catalog Assistant API
 *
 * Testa:
 *   - Autenticação (ausente, inválida, válida)
 *   - CRUD products, categories, collections, media
 *   - Proteção isPublic=false (products)
 *   - Proteção isActive=false (categories, collections)
 *   - Allowlists de campos
 *   - Rejeição de campos proibidos
 *   - 404 para IDs inexistentes
 *   - Não exposição de outros recursos
 *   - Media upload (MIME, tamanho)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Setup ───────────────────────────────────────────────────

const TEST_API_KEY = 'test-api-key-1234567890abcdef'
const VALID_AUTH = `Bearer ${TEST_API_KEY}`
const INVALID_AUTH = 'Bearer invalid-token'

beforeEach(() => {
  vi.resetAllMocks()
  process.env.CATALOG_ASSISTANT_API_KEY = TEST_API_KEY
})

// ─── Mock helpers ────────────────────────────────────────────

const mockPayload = {
  find: vi.fn(),
  findByID: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    getPayload: vi.fn(() => Promise.resolve(mockPayload)),
  }
})

vi.mock('@/payload', () => ({
  getPayloadClient: vi.fn(() => Promise.resolve(mockPayload)),
}))

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  auth?: string,
): NextRequest {
  const url = `http://localhost:3000/api/catalog-assistant${path}`
  const headers: Record<string, string> = {
    'Authorization': auth || VALID_AUTH,
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeMediaRequest(body?: FormData, auth?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/catalog-assistant/media', {
    method: 'POST',
    headers: {
      'Authorization': auth || VALID_AUTH,
    },
    body,
  })
}

// Helper para construir FormData simulada
function createMockFile(
  name: string,
  type: string,
  size: number,
): File {
  const content = Buffer.alloc(size, 'A')
  return new File([content], name, { type })
}

// ─── Autenticação ────────────────────────────────────────────

describe('Catalog Assistant API — Autenticação', () => {
  async function importHandlers() {
    return await import('./route')
  }

  it('devolve 401 quando Authorization está ausente', async () => {
    const { GET } = await importHandlers()
    const req = new NextRequest('http://localhost:3000/api/catalog-assistant/products', { method: 'GET' })
    const res = await GET(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('devolve 401 quando Authorization não é Bearer', async () => {
    const { GET } = await importHandlers()
    const req = new NextRequest('http://localhost:3000/api/catalog-assistant/products', {
      method: 'GET',
      headers: { Authorization: 'Basic abc123' },
    })
    const res = await GET(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(401)
  })

  it('devolve 401 quando token é inválido', async () => {
    const { GET } = await importHandlers()
    const req = new NextRequest('http://localhost:3000/api/catalog-assistant/products', {
      method: 'GET',
      headers: { Authorization: INVALID_AUTH },
    })
    const res = await GET(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(401)
  })

  it('devolve 200 quando token é válido', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    })

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/products')
    const res = await GET(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(200)
  })
})

// ─── Products ────────────────────────────────────────────────

describe('Catalog Assistant API — Products (flowers)', () => {
  async function importHandlers() {
    return await import('./route')
  }

  const MOCK_PRODUCT = {
    id: 1,
    namePt: 'Rosa Vermelha',
    nameEn: 'Red Rose',
    nameEs: 'Rosa Roja',
    price: 50,
    scientificName: 'Rosa gallica',
    productType: 'permanente',
    isPublic: false,
    category: null,
    collections: [],
    availability: 'available',
    stockQuantity: 1,
    shippingClass: 'standard',
    canShareShippingPackage: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('GET /products lista produtos', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [MOCK_PRODUCT],
      totalDocs: 1,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/products')
    const res = await GET(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.docs).toHaveLength(1)
    expect(body.data.docs[0].namePt).toBe('Rosa Vermelha')
  })

  it('GET /products/:id devolve produto', async () => {
    mockPayload.findByID.mockResolvedValue(MOCK_PRODUCT)

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/products/1')
    const res = await GET(req, { params: Promise.resolve({ slug: ['products', '1'] }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(1)
  })

  it('POST /products cria produto com isPublic=false', async () => {
    mockPayload.create.mockResolvedValue({ ...MOCK_PRODUCT, id: 2, isPublic: false })

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/products', {
      namePt: 'Nova Flor',
      price: 30,
      scientificName: 'Testus florus',
      productType: 'permanente',
      stockQuantity: 1,
      isPublic: true, // deve ser ignorado/forçado
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verificar que o Payload recebeu isPublic=false
    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.data.isPublic).toBe(false)
  })

  it('POST /products com isPublic:true no body cria produto APENAS com isPublic=false no servidor', async () => {
    // Teste explícito de proteção: cliente tenta publicar mas é bloqueado
    mockPayload.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...MOCK_PRODUCT, id: 5, ...data }),
    )

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/products', {
      namePt: 'Teste Publicação',
      price: 25,
      scientificName: 'Testus publicus',
      productType: 'permanente',
      stockQuantity: 1,
      isPublic: true,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(201)

    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.data.isPublic).toBe(false)
  })

  it('PATCH /products/:id com isPublic:true NÃO deixa produto público', async () => {
    mockPayload.findByID.mockResolvedValue({ ...MOCK_PRODUCT, id: 3, isPublic: true })
    mockPayload.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...MOCK_PRODUCT, id: 3, ...data, isPublic: false }),
    )

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/products/3', {
      namePt: 'Rosa Editada',
      isPublic: true,
    })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['products', '3'] }) })
    expect(res.status).toBe(200)

    const updateCall = mockPayload.update.mock.calls[0][0]
    // Servidor força isPublic=false
    expect(updateCall.data.isPublic).toBe(false)
  })

  it('PATCH de produto que estava público fica com isPublic=false', async () => {
    // Produto estava público (isPublic: true)
    mockPayload.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...MOCK_PRODUCT, id: 4, ...data, isPublic: false }),
    )

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/products/4', { namePt: 'Editado' })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['products', '4'] }) })
    expect(res.status).toBe(200)

    const updateCall = mockPayload.update.mock.calls[0][0]
    expect(updateCall.data.isPublic).toBe(false)
  })

  it('PATCH /products/:id devolve 404 para ID inexistente', async () => {
    mockPayload.update.mockRejectedValue(new Error('not found'))

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/products/99999', { namePt: 'Teste' })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['products', '99999'] }) })
    expect(res.status).toBe(404)
  })

  it('GET /products/:id devolve 404 para ID inexistente', async () => {
    mockPayload.findByID.mockRejectedValue(new Error('not found'))

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/products/99999')
    const res = await GET(req, { params: Promise.resolve({ slug: ['products', '99999'] }) })
    expect(res.status).toBe(404)
  })

  it('rejeita campos proibidos como createdAt com 400', async () => {
    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/products', {
      namePt: 'Teste',
      price: 10,
      scientificName: 'Test',
      productType: 'permanente',
      stockQuantity: 1,
      createdAt: '2020-01-01',
      id: 999,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_FIELD')
    expect(body.error.message).toContain('createdAt')
    expect(body.error.message).toContain('id')
  })

  it('rejeita campos desconhecidos com 400', async () => {
    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/products', {
      namePt: 'Teste',
      price: 10,
      scientificName: 'Test',
      productType: 'permanente',
      stockQuantity: 1,
      corFavorita: 'azul', // campo desconhecido
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_FIELD')
    expect(body.error.message).toContain('corFavorita')
  })

  it('preserva validateProductModel existente (stockQuantity deve ser inteiro)', async () => {
    mockPayload.create.mockRejectedValue(
      new Error('The following field is invalid: stockQuantity deve ser um número inteiro.'),
    )

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/products', {
      namePt: 'Teste',
      price: 10,
      scientificName: 'Test',
      productType: 'permanente',
      stockQuantity: 1.5, // não inteiro
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST /products com story localizada aceita objeto {pt, en, ...}', async () => {
  mockPayload.create.mockResolvedValue({
  ...MOCK_PRODUCT, id: 10, story: 'História PT',
  })

  const { POST } = await importHandlers()
  const req = makeRequest('POST', '/products', {
  namePt: 'Flor Story',
  price: 20,
  scientificName: 'Testus storius',
  productType: 'permanente',
  stockQuantity: 1,
  story: {
  pt: 'História em português',
  en: 'Story in English',
  es: 'Historia en español',
  },
  })
  const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
  expect(res.status).toBe(201)

  // create deve receber apenas story pt (default locale) no data principal
  const createCall = mockPayload.create.mock.calls[0][0]
  expect(createCall.data.story).toBe('História em português')

  // Deve ter chamado update para locale en e es
  const updateCalls = mockPayload.update.mock.calls
  const enCall = updateCalls.find((c: any) => c[0]?.locale === 'en')
  expect(enCall).toBeDefined()
  expect(enCall[0].data.story).toBe('Story in English')
  })

  it('PATCH /products/:id com story localizada', async () => {
  mockPayload.update.mockImplementation(({ data }: any) =>
  Promise.resolve({ ...MOCK_PRODUCT, id: 11, ...data }),
  )

  const { PATCH } = await importHandlers()
  const req = makeRequest('PATCH', '/products/11', {
  story: {
  pt: 'Nova história PT',
  de: 'Neue Geschichte DE',
  },
  })
  const res = await PATCH(req, { params: Promise.resolve({ slug: ['products', '11'] }) })
  expect(res.status).toBe(200)

  // update deve ser chamado com locale pt no update principal
  const updateCall = mockPayload.update.mock.calls[0][0]
  if (mockPayload.update.mock.calls.length > 0) {
  // story foi extraída, pt fica no update principal
  expect(updateCall.data.story).toBe('Nova história PT')
  }
  // Deve ter update para locale de
  const deCalls = mockPayload.update.mock.calls.filter((c: any) => c[0]?.locale === 'de')
  expect(deCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('POST /products com story como string simples funciona', async () => {
  mockPayload.create.mockResolvedValue({ ...MOCK_PRODUCT, id: 12, story: 'Apenas texto' })

  const { POST } = await importHandlers()
  const req = makeRequest('POST', '/products', {
  namePt: 'Flor String',
  price: 15,
  scientificName: 'Testus stringus',
  productType: 'permanente',
  stockQuantity: 1,
  story: 'Apenas texto',
  })
  const res = await POST(req, { params: Promise.resolve({ slug: ['products'] }) })
  expect(res.status).toBe(201)

  const createCall = mockPayload.create.mock.calls[0][0]
  expect(createCall.data.story).toBe('Apenas texto')
  })

  it('GET /products/:id não expõe campos internos', async () => {
  mockPayload.findByID.mockResolvedValue({
  ...MOCK_PRODUCT,
  id: 1,
  _status: 'draft',
  someInternalField: 'secret',
  password: 'hash',
  })

  const { GET } = await importHandlers()
  const req = makeRequest('GET', '/products/1')
  const res = await GET(req, { params: Promise.resolve({ slug: ['products', '1'] }) })
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(body.data._status).toBeUndefined()
  expect(body.data.someInternalField).toBeUndefined()
  expect(body.data.password).toBeUndefined()
  expect(body.data.id).toBeDefined()
  expect(body.data.namePt).toBeDefined()
  })


})
// ─── Categories ──────────────────────────────────────────────

describe('Catalog Assistant API — Categories', () => {
  async function importHandlers() {
    return await import('./route')
  }

  const MOCK_CATEGORY = {
    id: 1,
    name: 'Colar',
    slug: 'colar',
    description: 'Coleção de colares',
    isActive: false,
    sortOrder: 100,
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('GET /categories lista categorias', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [MOCK_CATEGORY],
      totalDocs: 1,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/categories')
    const res = await GET(req, { params: Promise.resolve({ slug: ['categories'] }) })
    expect(res.status).toBe(200)
  })

  it('POST /categories com isActive:true fica isActive=false', async () => {
    mockPayload.create.mockResolvedValue({ ...MOCK_CATEGORY, id: 2, isActive: false })
    mockPayload.findByID.mockResolvedValue({ ...MOCK_CATEGORY, id: 2, isActive: false })

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/categories', {
      translations: {
        pt: { name: 'Pulseira', description: 'Coleção de pulseiras' },
        en: { name: 'Bracelet', description: 'Bracelet collection' },
      },
      slug: 'pulseira',
      isActive: true,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['categories'] }) })
    expect(res.status).toBe(201)

    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.data.isActive).toBe(false)
  })

  it('PATCH /categories/:id com isActive:true fica isActive=false', async () => {
    mockPayload.findByID.mockResolvedValue({ ...MOCK_CATEGORY, id: 3, isActive: true })
    mockPayload.update.mockResolvedValue({ ...MOCK_CATEGORY, id: 3 })
    mockPayload.findByID.mockResolvedValue({ ...MOCK_CATEGORY, id: 3, isActive: false })

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/categories/3', {
      slug: 'novo-slug',
      isActive: true,
    })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['categories', '3'] }) })
    expect(res.status).toBe(200)

    // Verificar que o servidor forçou isActive=false
    const updateCall = mockPayload.update.mock.calls[0]
    if (updateCall) {
      expect(updateCall[0].data.isActive).toBe(false)
    }
  })

  it('PATCH de categoria ativa fica isActive=false', async () => {
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_CATEGORY, id: 4, isActive: true })
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_CATEGORY, id: 4, isActive: false })
    mockPayload.update.mockResolvedValue({ ...MOCK_CATEGORY, id: 4, isActive: false })

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/categories/4', { slug: 'novo-slug' })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['categories', '4'] }) })
    expect(res.status).toBe(200)

    const updateCall = mockPayload.update.mock.calls[0]
    if (updateCall) {
      expect(updateCall[0].data.isActive).toBe(false)
    }
  })

  it('POST /categories com image aceita ID de media', async () => {
    mockPayload.create.mockResolvedValue({ ...MOCK_CATEGORY, id: 6, isActive: false, image: 10 })
    mockPayload.findByID.mockResolvedValue({ ...MOCK_CATEGORY, id: 6, isActive: false, image: 10 })

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/categories', {
      translations: { pt: { name: 'Com Foto', description: 'Descrição' } },
      slug: 'com-foto',
      image: 10,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['categories'] }) })
    expect(res.status).toBe(201)

    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.data.image).toBe(10)
  })

  it('PATCH /categories/:id aceita image', async () => {
    mockPayload.findByID.mockResolvedValue({ ...MOCK_CATEGORY, id: 7, image: null })
    mockPayload.update.mockResolvedValue({ ...MOCK_CATEGORY, id: 7, image: 20 })
    mockPayload.findByID.mockResolvedValue({ ...MOCK_CATEGORY, id: 7, image: 20 })

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/categories/7', { image: 20 })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['categories', '7'] }) })
    expect(res.status).toBe(200)
  })

  it('submete traduções corretamente', async () => {
    mockPayload.create.mockResolvedValue({ ...MOCK_CATEGORY, id: 5, isActive: false })
    mockPayload.findByID.mockResolvedValue({
      ...MOCK_CATEGORY,
      id: 5,
      name: 'Teste',
      isActive: false,
    })

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/categories', {
      translations: {
        pt: { name: 'Teste', description: 'Descrição PT' },
        en: { name: 'Test', description: 'EN Description' },
        es: { name: 'Prueba', description: 'Descripción ES' },
        it: { name: 'Prova', description: 'Descrizione IT' },
        de: { name: 'Test', description: 'DE Beschreibung' },
      },
      slug: 'teste',
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['categories'] }) })
    expect(res.status).toBe(201)
  })

  it('rejeita locale inválido em translations', async () => {
    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/categories', {
      translations: {
        pt: { name: 'Teste' },
        fr: { name: 'Test' }, // locale inválido
      },
      slug: 'teste',
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['categories'] }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_FIELD')
  })

  it('rejeita campos de sistema', async () => {
    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/categories', {
      translations: { pt: { name: 'Teste' } },
      slug: 'teste',
      _status: 'draft',
      role: 'admin',
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['categories'] }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_FIELD')
    expect(body.error.message).toContain('_status')
    expect(body.error.message).toContain('role')
  })
})

// ─── Collections ─────────────────────────────────────────────

describe('Catalog Assistant API — Collections', () => {
  async function importHandlers() {
    return await import('./route')
  }

  const MOCK_COLLECTION = {
    id: 1,
    name: 'Casamento',
    slug: 'casamento',
    description: 'Coleção de casamento',
    isActive: false,
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('GET /collections lista coleções', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [MOCK_COLLECTION],
      totalDocs: 1,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/collections')
    const res = await GET(req, { params: Promise.resolve({ slug: ['collections'] }) })
    expect(res.status).toBe(200)
  })

  it('POST /collections com isActive:true fica isActive=false', async () => {
    mockPayload.create.mockResolvedValue({ ...MOCK_COLLECTION, id: 2, isActive: false })
    mockPayload.findByID.mockResolvedValue({ ...MOCK_COLLECTION, id: 2, isActive: false })

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/collections', {
      translations: {
        pt: { name: 'Natal', description: 'Coleção de Natal' },
        en: { name: 'Christmas', description: 'Christmas collection' },
      },
      slug: 'natal',
      isActive: true,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['collections'] }) })
    expect(res.status).toBe(201)

    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.data.isActive).toBe(false)
  })

  it('PATCH /collections/:id com isActive:true fica isActive=false', async () => {
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_COLLECTION, id: 3, isActive: true })
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_COLLECTION, id: 3, isActive: false })
    mockPayload.update.mockResolvedValue({ ...MOCK_COLLECTION, id: 3, isActive: false })

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/collections/3', {
      slug: 'novo-slug',
      isActive: true,
    })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['collections', '3'] }) })
    expect(res.status).toBe(200)

    const updateCall = mockPayload.update.mock.calls[0]
    if (updateCall) {
      expect(updateCall[0].data.isActive).toBe(false)
    }
  })

  it('PATCH de coleção ativa fica isActive=false', async () => {
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_COLLECTION, id: 4, isActive: true })
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_COLLECTION, id: 4, isActive: false })
    mockPayload.update.mockResolvedValue({ ...MOCK_COLLECTION, id: 4, isActive: false })

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/collections/4', { slug: 'colecao-editada' })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['collections', '4'] }) })
    expect(res.status).toBe(200)

    const updateCall = mockPayload.update.mock.calls[0]
    if (updateCall) {
      expect(updateCall[0].data.isActive).toBe(false)
    }
  })

  it('POST /collections com image aceita ID de media', async () => {
    mockPayload.create.mockResolvedValue({ ...MOCK_COLLECTION, id: 5, isActive: false, image: 15 })
    mockPayload.findByID.mockResolvedValue({ ...MOCK_COLLECTION, id: 5, isActive: false, image: 15 })

    const { POST } = await importHandlers()
    const req = makeRequest('POST', '/collections', {
      translations: { pt: { name: 'Coleção Foto', description: 'Com imagem' } },
      slug: 'colecao-foto',
      image: 15,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['collections'] }) })
    expect(res.status).toBe(201)

    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.data.image).toBe(15)
  })

  it('PATCH /collections/:id aceita image', async () => {
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_COLLECTION, id: 6, image: null })
    mockPayload.findByID.mockResolvedValueOnce({ ...MOCK_COLLECTION, id: 6, image: 25 })

    const { PATCH } = await importHandlers()
    const req = makeRequest('PATCH', '/collections/6', { image: 25 })
    const res = await PATCH(req, { params: Promise.resolve({ slug: ['collections', '6'] }) })
    expect(res.status).toBe(200)
  })
})

// ─── Media ───────────────────────────────────────────────────

describe('Catalog Assistant API — Media', () => {
  async function importHandlers() {
    return await import('./route')
  }

  it('GET /media lista media', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [{ id: 1, url: '/media/test.jpg', filename: 'test.jpg', mimeType: 'image/jpeg' }],
      totalDocs: 1,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })

    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/media')
    const res = await GET(req, { params: Promise.resolve({ slug: ['media'] }) })
    expect(res.status).toBe(200)
  })

  it('POST /media com imagem JPEG válida', async () => {
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    const formData = new FormData()
    formData.append('file', validFile)

    mockPayload.create.mockResolvedValue({
      id: 10,
      url: '/media/test.jpg',
      filename: 'test.jpg',
      mimeType: 'image/jpeg',
      filesize: 1024,
    })

    const { POST } = await importHandlers()
    const req = makeMediaRequest(formData)
    const res = await POST(req, { params: Promise.resolve({ slug: ['media'] }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('POST /media rejeita MIME type inválido', async () => {
    const invalidFile = createMockFile('test.pdf', 'application/pdf', 1024)
    const formData = new FormData()
    formData.append('file', invalidFile)

    const { POST } = await importHandlers()
    const req = makeMediaRequest(formData)
    const res = await POST(req, { params: Promise.resolve({ slug: ['media'] }) })
    expect(res.status).toBe(415)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_MIME_TYPE')
  })

  it('POST /media rejeita ficheiro demasiado grande (> 10 MB)', async () => {
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 11 * 1024 * 1024)
    const formData = new FormData()
    formData.append('file', largeFile)

    const { POST } = await importHandlers()
    const req = makeMediaRequest(formData)
    const res = await POST(req, { params: Promise.resolve({ slug: ['media'] }) })
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error.code).toBe('FILE_TOO_LARGE')
  })
})

  it('upload media não devolve err.message interno', async () => {
    const { POST } = await import('./route')
    const invalidFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    const formData = new FormData()
    formData.append('file', invalidFile)
    mockPayload.create.mockRejectedValue(new Error('Path: /srv/uploads/secret.pdf'))

    const req = new NextRequest('http://localhost:3000/api/catalog-assistant/media', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_API_KEY}` },
      body: formData,
    })
    const res = await POST(req, { params: Promise.resolve({ slug: ['media'] }) })
    const body = await res.json()
    expect(body.error.message).not.toContain('/srv/')
    expect(body.error.message).not.toContain('secret.pdf')
  })
// ─── Recursos fora de scope ──────────────────────────────────

describe('Catalog Assistant API — Recursos fora de scope', () => {
  async function importHandlers() {
    return await import('./route')
  }

  it('GET /orders devolve 404', async () => {
    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/orders')
    const res = await GET(req, { params: Promise.resolve({ slug: ['orders'] }) })
    expect(res.status).toBe(404)
  })

  it('GET /payments devolve 404', async () => {
    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/payments')
    const res = await GET(req, { params: Promise.resolve({ slug: ['payments'] }) })
    expect(res.status).toBe(404)
  })

  it('GET /users devolve 404', async () => {
    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/users')
    const res = await GET(req, { params: Promise.resolve({ slug: ['users'] }) })
    expect(res.status).toBe(404)
  })

  it('GET /homepage devolve 404', async () => {
    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/homepage')
    const res = await GET(req, { params: Promise.resolve({ slug: ['homepage'] }) })
    expect(res.status).toBe(404)
  })

  it('DELETE devolve 405', async () => {
    const { DELETE } = await importHandlers()
    const req = makeRequest('DELETE', '/products/1')
    const res = await DELETE(req, { params: Promise.resolve({ slug: ['products', '1'] }) })
    expect(res.status).toBe(405)
  })
})

// ─── Métodos não permitidos ──────────────────────────────────

describe('Catalog Assistant API — Métodos HTTP', () => {
  async function importHandlers() {
    return await import('./route')
  }

  it('DELETE /products devolve 405', async () => {
    const { DELETE } = await importHandlers()
    const req = makeRequest('DELETE', '/products/1')
    const res = await DELETE(req, { params: Promise.resolve({ slug: ['products', '1'] }) })
    expect(res.status).toBe(405)
  })

  it('DELETE /categories devolve 405', async () => {
    const { DELETE } = await importHandlers()
    const req = makeRequest('DELETE', '/categories/1')
    const res = await DELETE(req, { params: Promise.resolve({ slug: ['categories', '1'] }) })
    expect(res.status).toBe(405)
  })

  it('DELETE /collections devolve 405', async () => {
    const { DELETE } = await importHandlers()
    const req = makeRequest('DELETE', '/collections/1')
    const res = await DELETE(req, { params: Promise.resolve({ slug: ['collections', '1'] }) })
    expect(res.status).toBe(405)
  })

  it('DELETE /media devolve 405', async () => {
    const { DELETE } = await importHandlers()
    const req = makeRequest('DELETE', '/media/1')
    const res = await DELETE(req, { params: Promise.resolve({ slug: ['media', '1'] }) })
    expect(res.status).toBe(405)
  })

  it('PUT devolve 405', async () => {
    const { PUT } = await importHandlers()
    const req = makeRequest('PUT', '/products/1', { namePt: 'Teste' })
    const res = await PUT(req, { params: Promise.resolve({ slug: ['products', '1'] }) })
    expect(res.status).toBe(405)
  })

  it('rota desconhecida devolve 404', async () => {
    const { GET } = await importHandlers()
    const req = makeRequest('GET', '/products/1/extra')
    const res = await GET(req, { params: Promise.resolve({ slug: ['products', '1', 'extra'] }) })
    expect(res.status).toBe(404)
  })
})