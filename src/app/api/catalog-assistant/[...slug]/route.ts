/**
 * /api/catalog-assistant/[...slug]/route.ts
 *
 * Route handler for the Catalog Assistant API.
 * Mapeia URLs REST para as funções do serviço catalog-assistant.
 *
 * Namespace: /api/catalog-assistant
 *
 * Recursos permitidos:
 *   - products (flowers)
 *   - categories
 *   - collections
 *   - media
 *
 * NÃO existem rotas para: orders, payments, homepage, site-settings, users,
 * coupons, stock-reservations, ou qualquer outro recurso.
 */

import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  listMedia,
  getMedia,
  createMedia,
} from '@/services/catalog-assistant'

function error(msg: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: msg } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Mapeia o slug da URL para o handler correspondente.
 *
 * Padrão: /api/catalog-assistant/:resource[/:id]
 */
async function routeHandler(
  req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const slug = (await params).slug

  if (!slug || slug.length === 0 || slug.length > 2) {
    return error('Rota não encontrada.', 404)
  }

  const [resource, id] = slug
  const method = req.method

  // ─── Products ──────────────────────────────────────────────
  if (resource === 'products') {
    switch (method) {
      case 'GET':
        return id ? getProduct(req, id) : listProducts(req)
      case 'POST':
        if (id) return error('Método não permitido. Use POST sem ID para criar.', 405)
        return createProduct(req)
      case 'PATCH':
        if (!id) return error('ID é obrigatório para PATCH.', 400)
        return updateProduct(req, id)
      default:
        return error('Método HTTP não permitido.', 405)
    }
  }

  // ─── Categories ────────────────────────────────────────────
  if (resource === 'categories') {
    switch (method) {
      case 'GET':
        return id ? getCategory(req, id) : listCategories(req)
      case 'POST':
        if (id) return error('Método não permitido. Use POST sem ID para criar.', 405)
        return createCategory(req)
      case 'PATCH':
        if (!id) return error('ID é obrigatório para PATCH.', 400)
        return updateCategory(req, id)
      default:
        return error('Método HTTP não permitido.', 405)
    }
  }

  // ─── Collections ───────────────────────────────────────────
  if (resource === 'collections') {
    switch (method) {
      case 'GET':
        return id ? getCollection(req, id) : listCollections(req)
      case 'POST':
        if (id) return error('Método não permitido. Use POST sem ID para criar.', 405)
        return createCollection(req)
      case 'PATCH':
        if (!id) return error('ID é obrigatório para PATCH.', 400)
        return updateCollection(req, id)
      default:
        return error('Método HTTP não permitido.', 405)
    }
  }

  // ─── Media ─────────────────────────────────────────────────
  if (resource === 'media') {
    switch (method) {
      case 'GET':
        return id ? getMedia(req, id) : listMedia(req)
      case 'POST':
        if (id) return error('Método não permitido. Use POST sem ID para criar.', 405)
        return createMedia(req)
      default:
        return error('Método HTTP não permitido.', 405)
    }
  }

  // ─── Qualquer outro recurso → 404 ─────────────────────────
  return error('Recurso não encontrado. Recursos válidos: products, categories, collections, media.', 404)
}

export const GET = routeHandler
export const POST = routeHandler
export const PATCH = routeHandler

// DELETE, PUT, OPTIONS não implementados
export const DELETE = async (req: Request, { params }: { params: Promise<{ slug: string[] }> }) =>
  error('DELETE não está disponível na Catalog Assistant API.', 405)
export const PUT = async (req: Request, { params }: { params: Promise<{ slug: string[] }> }) =>
  error('PUT não está disponível. Use PATCH para atualizações parciais.', 405)