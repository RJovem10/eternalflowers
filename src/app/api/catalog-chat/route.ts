/**
 * /api/catalog-chat/route.ts — Chat API endpoint
 *
 * Processa mensagens do assistente de catálogo usando OpenAI.
 * Requer autenticação Payload Admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPayloadAdmin } from '@/lib/catalog-auth'
import { processChatMessage } from '@/services/catalog-chat'
import type { ChatMessage } from '@/components/chat/types'

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
    const { messages, imageData } = body as { messages: ChatMessage[]; imageData?: string }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Mensagens são obrigatórias.' } },
        { status: 400 },
      )
    }

    // Validar tamanho da imagem (max 10MB)
    if (imageData) {
      const size = Buffer.byteLength(imageData, 'utf-8')
      if (size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: { code: 'IMAGE_TOO_LARGE', message: 'Imagem demasiado grande. Máximo 10 MB.' } },
          { status: 413 },
        )
      }
    }

    const result = await processChatMessage({ messages, imageData })

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[catalog-chat] Error:', err.message)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    )
  }
}