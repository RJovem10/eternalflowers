/**
 * POST /api/email-notifications/process
 *
 * Endpoint ADMIN autenticado para processar manualmente a outbox.
 *
 * Regras:
 * - req.user obrigatório → 401 se não autenticado (via Payload admin)
 * - Não aceita recipients/content/provider no body
 * - Resolve provider exclusivamente server-side via getConfiguredEmailProvider()
 * - Chama processPendingEmailNotifications() com batch limit seguro
 * - Devolve apenas resumo: processed, sent, failed, skipped
 * - Nunca devolve conteúdo de emails nem secrets
 *
 * Uso temporário até scheduler interno. Base para futuro cron.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { processPendingEmailNotifications } from '@/services/email/email-notifications'
import type { EmailProvider } from '@/services/email/email-provider'
import { getConfiguredEmailProvider } from '@/services/email/get-email-provider'
import { EmailProviderNotConfiguredError } from '@/services/email/email-provider-errors'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // ─── 1. Autenticação via Payload admin ─────────────────
    // A rota está fora do proxy Payload, por isso verificamos
    // a sessão manualmente através do token do cookie.
    let user: any = null

    try {
      // Payload expõe um helper de autenticação que lê o cookie
      const { user: foundUser } = await payload.auth({
        headers: Object.fromEntries(req.headers.entries()),
      } as any)
      user = foundUser
    } catch {
      // Falha silenciosa — cai no 401 abaixo
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária. Faça login no Admin Panel.' },
        { status: 401 },
      )
    }

    // ─── 2. Rejeitar body que tenta controlar recipient/provider ──
    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      // Sem body — válido, usamos defaults
    }

    if (body && typeof body === 'object') {
      const input = body as Record<string, unknown>
      if (input.recipientEmail || input.to || input.provider) {
        return NextResponse.json(
          {
            error:
              'Parâmetros não permitidos. O provider e destinatário são exclusivamente server-side.',
          },
          { status: 400 },
        )
      }
    }

    // ─── 3. Resolver provider server-side ──────────────────
    let provider: EmailProvider
    try {
      provider = await getConfiguredEmailProvider()
    } catch (err: unknown) {
      if (err instanceof EmailProviderNotConfiguredError) {
        return NextResponse.json({ error: err.message }, { status: 503 })
      }
      throw err
    }

    // ─── 4. Processar outbox ───────────────────────────────
    const summary = await processPendingEmailNotifications(payload, {
      provider,
      batchLimit: 20,
    })

    // ─── 5. Devolver apenas resumo ─────────────────────────
    return NextResponse.json({
      processed: summary.processed,
      sent: summary.sent,
      failed: summary.failed,
      skipped: summary.skipped,
    })
  } catch (err: any) {
    console.error('[email-notifications/process] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 },
    )
  }
}