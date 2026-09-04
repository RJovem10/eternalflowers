/**
 * /api/catalog-chat/route.ts — Chat API endpoint
 *
 * Processa mensagens do assistente de catálogo usando OpenAI Chat Completions API.
 * Requer autenticação Payload Admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPayloadAdmin } from '@/lib/catalog-auth'
import { processChatMessage } from '@/services/catalog-chat'
import type { ChatMessage } from '@/components/chat/types'

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Extrai o MIME type de uma data URL.
 */
function getMimeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([a-z]+\/[a-z-]+);/)
  return match ? match[1] : null
}

/**
 * Calcula o tamanho real dos bytes descodificados de uma data URL base64.
 */
function getDecodedSize(dataUrl: string): number {
  const match = dataUrl.match(/^data:[a-z]+\/[a-z-]+;base64,(.+)$/)
  if (!match) return 0
  const base64 = match[1]
  // base64 overhead: cada 4 chars = 3 bytes
  return Math.floor(base64.length * 3 / 4)
}

export async function POST(request: NextRequest) {
  try {
    // ─── Autenticação ─────────────────────────────────────
    const token = request.cookies.get('payload-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' } },
        { status: 401 },
      )
    }

    const user = await verifyPayloadAdmin(token)
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } },
        { status: 401 },
      )
    }

    // ─── Processar mensagem ───────────────────────────────
    const body = await request.json()
    const { messages } = body as { messages: ChatMessage[] }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Mensagens são obrigatórias.' } },
        { status: 400 },
      )
    }

    // ─── Validar imagens nas mensagens ─────────────────────
    for (const msg of messages) {
      if (msg.imageData) {
        // Validar formato data URL
        if (!msg.imageData.startsWith('data:image/') || !msg.imageData.includes(';base64,')) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_IMAGE_FORMAT', message: 'Formato de imagem inválido. Deve ser uma data URL base64.' } },
            { status: 400 },
          )
        }

        // Validar MIME type
        const mime = getMimeFromDataUrl(msg.imageData)
        if (!mime || !ALLOWED_IMAGE_MIME.has(mime)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_MIME_TYPE', message: `Tipo de imagem não suportado: "${mime || 'desconhecido'}". Aceite: JPEG, PNG, WebP.` } },
            { status: 415 },
          )
        }

        // Validar tamanho real descodificado (max 10 MB)
        const decodedSize = getDecodedSize(msg.imageData)
        if (decodedSize > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { success: false, error: { code: 'IMAGE_TOO_LARGE', message: 'Imagem demasiado grande. Máximo 10 MB.' } },
            { status: 413 },
          )
        }
      }
    }

    const result = await processChatMessage({ messages })

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[catalog-chat] Error:', err.message)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    )
  }
}