/**
 * catalog-chat.ts — Serviço de chat com OpenAI Chat Completions API
 *
 * Integra a OpenAI Chat Completions API com function/tool calling.
 * Todas as chamadas à Catalog Assistant API são feitas server-side.
 */

import OpenAI from 'openai'
import type { ChatMessage } from '@/components/chat/types'

// ─── Constantes ──────────────────────────────────────────────

const CATALOG_API_PREFIX = '/api/catalog-assistant'
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

// ─── Tipos ───────────────────────────────────────────────────

export interface ChatRequest {
  messages: ChatMessage[]
}

export interface ChatResponse {
  messages: ChatMessage[]
}

// ─── Tools (Function Calling) — 15 tools ────────────────────

export const CATALOG_TOOLS: OpenAI.ChatCompletionTool[] = [
  // ── Products ──────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listProducts',
      description: 'Lista produtos com paginação e pesquisa opcional',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'integer', description: 'Número da página (default: 1)' },
          limit: { type: 'integer', description: 'Itens por página (default: 20, max: 100)' },
          search: { type: 'string', description: 'Termo de pesquisa (nome, SKU, nome científico)' },
          sku: { type: 'string', description: 'Pesquisa exata por SKU' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProduct',
      description: 'Obtém um produto pelo ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID do produto' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createProduct',
      description: 'Cria um novo produto. O servidor força isPublic=false automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          namePt: { type: 'string', description: 'Nome (Português) — obrigatório' },
          nameEn: { type: 'string', description: 'Nome (Inglês)' },
          nameEs: { type: 'string', description: 'Nome (Espanhol)' },
          nameIt: { type: 'string', description: 'Nome (Italiano)' },
          nameDe: { type: 'string', description: 'Nome (Alemão)' },
          productType: { type: 'string', enum: ['permanente', 'sazonal', 'exclusivo'], description: 'Tipo de Produto' },
          scientificName: { type: 'string', description: 'Nome Científico — obrigatório' },
          creationName: { type: 'string', description: 'Nome da Criação' },
          price: { type: 'number', description: 'Preço (€) — obrigatório' },
          descriptionPt: { type: 'string', description: 'Descrição (PT)' },
          descriptionEn: { type: 'string', description: 'Descrição (EN)' },
          descriptionEs: { type: 'string', description: 'Descrição (ES)' },
          descriptionIt: { type: 'string', description: 'Descrição (IT)' },
          descriptionDe: { type: 'string', description: 'Descrição (DE)' },
          image: { type: 'integer', description: 'ID da media (foto principal)' },
          images: {
            type: 'array',
            description: 'Galeria de imagens',
            items: {
              type: 'object',
              properties: { image: { type: 'integer', description: 'ID da media' } },
            },
          },
          availability: { type: 'string', enum: ['available', 'reserved', 'sold', 'preparing'], description: 'Disponibilidade' },
          sku: { type: 'string', description: 'Código (SKU)' },
          productionMode: { type: 'string', enum: ['unique', 'reproducible', 'made_to_order'], description: 'Modo de Produção' },
          productionLeadTime: { type: 'integer', description: 'Prazo de produção (dias úteis, apenas made_to_order)' },
          stockQuantity: { type: 'integer', description: 'Quantidade em stock' },
          shippingClass: { type: 'string', enum: ['standard', 'cupula'], description: 'Classe de Expedição' },
          canShareShippingPackage: { type: 'boolean', description: 'Pode partilhar embalagem de envio' },
          category: { type: 'integer', description: 'ID da categoria' },
          collections: { type: 'array', items: { type: 'integer' }, description: 'IDs das coleções' },
          story: {
            type: 'object',
            description: 'História da Peça por locale',
            properties: {
              pt: { type: 'string' },
              en: { type: 'string' },
              es: { type: 'string' },
              it: { type: 'string' },
              de: { type: 'string' },
            },
          },
        },
        required: ['namePt', 'price', 'scientificName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateProduct',
      description: 'Atualiza um produto existente. O servidor força isPublic=false automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID do produto a atualizar' },
          namePt: { type: 'string' },
          nameEn: { type: 'string' },
          nameEs: { type: 'string' },
          nameIt: { type: 'string' },
          nameDe: { type: 'string' },
          productType: { type: 'string', enum: ['permanente', 'sazonal', 'exclusivo'] },
          scientificName: { type: 'string' },
          creationName: { type: 'string' },
          price: { type: 'number' },
          descriptionPt: { type: 'string' },
          descriptionEn: { type: 'string' },
          descriptionEs: { type: 'string' },
          descriptionIt: { type: 'string' },
          descriptionDe: { type: 'string' },
          image: { type: 'integer' },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: { image: { type: 'integer' } },
            },
          },
          availability: { type: 'string', enum: ['available', 'reserved', 'sold', 'preparing'] },
          sku: { type: 'string' },
          productionMode: { type: 'string', enum: ['unique', 'reproducible', 'made_to_order'] },
          productionLeadTime: { type: 'integer' },
          stockQuantity: { type: 'integer' },
          shippingClass: { type: 'string', enum: ['standard', 'cupula'] },
          canShareShippingPackage: { type: 'boolean' },
          category: { type: 'integer' },
          collections: { type: 'array', items: { type: 'integer' } },
          story: {
            type: 'object',
            description: 'História da Peça por locale',
            properties: {
              pt: { type: 'string' },
              en: { type: 'string' },
              es: { type: 'string' },
              it: { type: 'string' },
              de: { type: 'string' },
            },
          },
        },
        required: ['id'],
      },
    },
  },

  // ── Categories ────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listCategories',
      description: 'Lista categorias com paginação e pesquisa opcional',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          search: { type: 'string', description: 'Pesquisa por nome' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCategory',
      description: 'Obtém uma categoria pelo ID',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'ID da categoria' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createCategory',
      description: 'Cria uma nova categoria. O servidor força isActive=false automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Slug único — obrigatório' },
          translations: {
            type: 'object',
            description: 'Traduções por idioma (pt, en, es, it, de)',
            properties: {
              pt: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              en: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              es: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              it: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              de: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
            },
          },
          image: { type: 'integer', description: 'ID da media (imagem de capa)' },
          sortOrder: { type: 'integer' },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateCategory',
      description: 'Atualiza uma categoria existente. O servidor força isActive=false automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID da categoria' },
          slug: { type: 'string' },
          translations: {
            type: 'object',
            properties: {
              pt: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              en: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              es: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              it: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              de: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
            },
          },
          image: { type: 'integer' },
          sortOrder: { type: 'integer' },
        },
        required: ['id'],
      },
    },
  },

  // ── Collections ───────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listCollections',
      description: 'Lista coleções com paginação e pesquisa opcional',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          search: { type: 'string', description: 'Pesquisa por nome' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCollection',
      description: 'Obtém uma coleção pelo ID',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'ID da coleção' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createCollection',
      description: 'Cria uma nova coleção. O servidor força isActive=false automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Slug único — obrigatório' },
          translations: {
            type: 'object',
            properties: {
              pt: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              en: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              es: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              it: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              de: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
            },
          },
          image: { type: 'integer', description: 'ID da media (imagem de capa)' },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateCollection',
      description: 'Atualiza uma coleção existente. O servidor força isActive=false automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID da coleção' },
          slug: { type: 'string' },
          translations: {
            type: 'object',
            properties: {
              pt: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              en: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              es: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              it: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
              de: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
            },
          },
          image: { type: 'integer' },
        },
        required: ['id'],
      },
    },
  },

  // ── Media ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listMedia',
      description: 'Lista media com paginação',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMedia',
      description: 'Obtém um item de media pelo ID',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'ID da media' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'uploadMedia',
      description: 'Guarda a fotografia anexada na conversa no catálogo. Usa a imagem que a Marina enviou na mensagem anterior.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

// ─── System Instructions ─────────────────────────────────────

const SYSTEM_INSTRUCTIONS = `És o assistente de catálogo da Eternal Flowers, uma marca portuguesa de joias botânicas artesanais.

Trabalhas com a Marina, a criadora da marca.

As tuas responsabilidades:
- Podes consultar produtos, categorias, coleções e media.
- Só crias ou alteras dados quando a Marina pedir explicitamente.
- Nunca eliminas dados.
- Não inventas IDs. Antes de criar, verifica se já existe produto/categoria/coleção semelhante quando apropriado.
- Respeitas os campos definidos pela API.
- Fotografias originais não devem ser modificadas.
- Para guardar uma fotografia anexada, usa a ferramenta uploadMedia. Depois do upload, recebes o media ID e podes usá-lo ao criar/editar produtos, categorias ou coleções.

Regras de segurança que o servidor já aplica automaticamente:
- Produtos criados ou editados ficam com isPublic=false (não visíveis no site)
- Categorias criadas ou editadas ficam com isActive=false
- Coleções criadas ou editadas ficam com isActive=false
- A Marina revê e ativa manualmente no Payload Admin

Responde sempre em português de Portugal, de forma clara e amigável.
Explica o que fizeste e pergunta se a Marina quer mais alguma alteração.`

// ─── Funções auxiliares ──────────────────────────────────────

function getCatalogApiKey(): string {
  const key = process.env.CATALOG_ASSISTANT_API_KEY
  if (!key) {
    throw new Error('CATALOG_ASSISTANT_API_KEY não configurada')
  }
  return key
}

async function callCatalogApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const apiKey = getCatalogApiKey()

  const url = `${serverUrl}${CATALOG_API_PREFIX}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })

  const data = await res.json()
  return { status: res.status, data }
}

/**
 * Faz upload de media para a Catalog Assistant API via multipart/form-data.
 * Preserva bytes originais, sem redimensionamento.
 */
async function uploadMediaToCatalog(
  imageDataUrl: string,
): Promise<{ status: number; data: unknown }> {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const apiKey = getCatalogApiKey()

  // Extrair base64 e MIME da data URL
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) {
    return { status: 400, data: { success: false, error: { code: 'INVALID_DATA_URL', message: 'Formato de imagem inválido.' } } }
  }

  const mimeType = match[1]
  const base64Data = match[2]

  if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
    return { status: 415, data: { success: false, error: { code: 'INVALID_MIME_TYPE', message: 'Tipo de imagem não suportado.' } } }
  }

  // Descodificar base64 para bytes
  const buffer = Buffer.from(base64Data, 'base64')

  // Verificar tamanho (max 10 MB)
  if (buffer.length > 10 * 1024 * 1024) {
    return { status: 413, data: { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Imagem demasiado grande. Máximo 10 MB.' } } }
  }

  // Gerar nome de ficheiro
  const ext = mimeType.split('/')[1]
  const filename = `catalog-upload-${Date.now()}.${ext}`

  // Construir FormData
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType })
  formData.append('file', blob, filename)

  const url = `${serverUrl}${CATALOG_API_PREFIX}/media`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(60000),
  })

  const data = await res.json()
  return { status: res.status, data }
}

/**
 * Sanitiza uma string de resultado para não expor detalhes internos.
 */
function sanitizeToolResult(result: string): string {
  // Se o resultado contém erro com path interno, substituir
  try {
    const parsed = JSON.parse(result)
    if (parsed?.error && typeof parsed.error === 'string') {
      // Substituir mensagem de erro técnica por genérica
      parsed.error = 'Erro interno ao executar operação.'
      return JSON.stringify(parsed)
    }
    if (parsed?.error?.message) {
      parsed.error.message = 'Erro interno ao executar operação.'
      return JSON.stringify(parsed)
    }
  } catch {
    // Não é JSON — devolver como está
  }
  return result
}

/**
 * Processa um tool call da OpenAI.
 * Executa a operação na Catalog Assistant API e retorna o resultado sanitizado.
 * NUNCA devolve err.message, paths, stacks, ou secrets ao modelo.
 */
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  pendingImageData?: string | null,
): Promise<string> {
  try {
    switch (toolName) {
      // ── Products ────────────────────────────────────────
      case 'listProducts': {
        const params = new URLSearchParams()
        if (args.page) params.set('page', String(args.page))
        if (args.limit) params.set('limit', String(args.limit))
        if (args.search) params.set('search', String(args.search))
        if (args.sku) params.set('sku', String(args.sku))
        const qs = params.toString()
        const { data } = await callCatalogApi('GET', `/products${qs ? `?${qs}` : ''}`)
        return JSON.stringify(data)
      }
      case 'getProduct': {
        const { data } = await callCatalogApi('GET', `/products/${args.id}`)
        return JSON.stringify(data)
      }
      case 'createProduct': {
        const { id, ...productData } = args
        const { data } = await callCatalogApi('POST', '/products', productData)
        return JSON.stringify(data)
      }
      case 'updateProduct': {
        const { id, ...productData } = args
        const { data } = await callCatalogApi('PATCH', `/products/${id}`, productData)
        return JSON.stringify(data)
      }

      // ── Categories ──────────────────────────────────────
      case 'listCategories': {
        const params = new URLSearchParams()
        if (args.page) params.set('page', String(args.page))
        if (args.limit) params.set('limit', String(args.limit))
        if (args.search) params.set('search', String(args.search))
        const qs = params.toString()
        const { data } = await callCatalogApi('GET', `/categories${qs ? `?${qs}` : ''}`)
        return JSON.stringify(data)
      }
      case 'getCategory': {
        const { data } = await callCatalogApi('GET', `/categories/${args.id}`)
        return JSON.stringify(data)
      }
      case 'createCategory': {
        const { id, ...catData } = args
        const { data } = await callCatalogApi('POST', '/categories', catData)
        return JSON.stringify(data)
      }
      case 'updateCategory': {
        const { id, ...catData } = args
        const { data } = await callCatalogApi('PATCH', `/categories/${id}`, catData)
        return JSON.stringify(data)
      }

      // ── Collections ─────────────────────────────────────
      case 'listCollections': {
        const params = new URLSearchParams()
        if (args.page) params.set('page', String(args.page))
        if (args.limit) params.set('limit', String(args.limit))
        if (args.search) params.set('search', String(args.search))
        const qs = params.toString()
        const { data } = await callCatalogApi('GET', `/collections${qs ? `?${qs}` : ''}`)
        return JSON.stringify(data)
      }
      case 'getCollection': {
        const { data } = await callCatalogApi('GET', `/collections/${args.id}`)
        return JSON.stringify(data)
      }
      case 'createCollection': {
        const { id, ...colData } = args
        const { data } = await callCatalogApi('POST', '/collections', colData)
        return JSON.stringify(data)
      }
      case 'updateCollection': {
        const { id, ...colData } = args
        const { data } = await callCatalogApi('PATCH', `/collections/${id}`, colData)
        return JSON.stringify(data)
      }

      // ── Media ───────────────────────────────────────────
      case 'listMedia': {
        const params = new URLSearchParams()
        if (args.page) params.set('page', String(args.page))
        if (args.limit) params.set('limit', String(args.limit))
        const qs = params.toString()
        const { data } = await callCatalogApi('GET', `/media${qs ? `?${qs}` : ''}`)
        return JSON.stringify(data)
      }
      case 'getMedia': {
        const { data } = await callCatalogApi('GET', `/media/${args.id}`)
        return JSON.stringify(data)
      }

      // ── Upload Media ────────────────────────────────────
      case 'uploadMedia': {
        if (!pendingImageData) {
          return JSON.stringify({
            success: false,
            error: 'Não existe uma fotografia anexada disponível para guardar. Pede à Marina para enviar primeiro a fotografia.',
          })
        }
        const result = await uploadMediaToCatalog(pendingImageData)
        if (result.status >= 400) {
          const errData = result.data as any
          return JSON.stringify({
            success: false,
            error: errData?.error?.message || 'Erro ao fazer upload da fotografia.',
          })
        }
        return JSON.stringify(result.data)
      }

      default:
        return JSON.stringify({ error: 'Operação não reconhecida.' })
    }
  } catch (err: any) {
    // Log interno mantém detalhe técnico
    console.error(`[catalog-chat] tool ${toolName} error:`, err.message)
    // Resultado externo — genérico, sem detalhes
    return JSON.stringify({ error: 'Erro interno ao executar operação.' })
  }
}

// ─── Função principal ────────────────────────────────────────

/**
 * Processa uma mensagem de chat usando a OpenAI Chat Completions API.
 * Retorna o histórico de mensagens atualizado.
 */
export async function processChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada')
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra'

  const openai = new OpenAI({ apiKey })

  // Construir mensagens para o modelo
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_INSTRUCTIONS },
  ]

  // Encontrar a última imagem na conversa para uploadMedia
  let pendingImageData: string | null = null

  // Adicionar mensagens anteriores
  for (const msg of request.messages) {
    if (msg.role === 'user') {
      const content: OpenAI.ChatCompletionUserMessageParam['content'] = []
      content.push({ type: 'text', text: msg.content })

      // Se houver imagem nesta mensagem, guardar para uploadMedia e enviar ao modelo
      if (msg.imageData) {
        pendingImageData = msg.imageData
        content.push({
          type: 'image_url',
          image_url: { url: msg.imageData, detail: 'high' },
        })
      }

      messages.push({ role: 'user', content })
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content })
    }
  }

  // Tool calling em loop (até 10 iterações)
  let maxIterations = 10
  let responseMessages: ChatMessage[] = [...request.messages]

  while (maxIterations-- > 0) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: CATALOG_TOOLS,
      tool_choice: 'auto',
      max_tokens: 4096,
    })

    const choice = completion.choices[0]
    const responseMsg = choice.message

    if (!responseMsg.tool_calls || responseMsg.tool_calls.length === 0) {
      // Resposta final do modelo
      const content = responseMsg.content || ''
      responseMessages.push({
        role: 'assistant',
        content,
      })
      break
    }

    // Adicionar mensagem do assistente com tool calls
    const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
      role: 'assistant',
      content: responseMsg.content || null,
      tool_calls: responseMsg.tool_calls.map(tc => {
        const ftc = tc as any
        return {
          id: ftc.id,
          type: 'function' as const,
          function: { name: ftc.function.name, arguments: ftc.function.arguments },
        }
      }),
    }
    messages.push(assistantMsg)

    // Executar cada tool call
    for (const toolCall of responseMsg.tool_calls) {
      const tc = toolCall as any
      const name = tc.function.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments)
      } catch {
        args = {}
      }

      const result = await executeToolCall(name, args, pendingImageData)

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      } as OpenAI.ChatCompletionToolMessageParam)
    }
  }

  return { messages: responseMessages }
}