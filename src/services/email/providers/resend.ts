/**
 * resend.ts — Resend Email Provider
 *
 * Provider real para envio de emails transacionais via Resend.
 * Usa o SDK oficial (resend).
 *
 * Pré-requisitos (env vars):
 *   RESEND_API_KEY       — obrigatório
 *   EMAIL_FROM           — obrigatório
 *   EMAIL_REPLY_TO       — opcional
 *
 * A idempotencyKey da outbox é passada ao Resend como cabeçalho
 * Idempotency-Key (via CreateEmailRequestOptions).
 */
import { Resend } from 'resend'
import type { EmailProvider, EmailSendInput, EmailSendResult } from '../email-provider'
import { EmailProviderNotConfiguredError, EmailProviderError } from '../email-provider-errors'

// ─── Config ─────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM
  const emailReplyTo = process.env.EMAIL_REPLY_TO

  if (!apiKey || !apiKey.trim()) {
    throw new EmailProviderNotConfiguredError('RESEND_API_KEY não configurada.')
  }
  if (!emailFrom || !emailFrom.trim()) {
    throw new EmailProviderNotConfiguredError('EMAIL_FROM não configurado.')
  }

  return {
    apiKey,
    from: emailFrom.trim(),
    replyTo: emailReplyTo?.trim() || undefined,
  }
}

// ─── Singleton Resend client ────────────────────────────────

let client: Resend | null = null

function getClient(): Resend {
  if (!client) {
    const { apiKey } = getConfig()
    client = new Resend(apiKey)
  }
  return client
}

/**
 * Limpa o client Resend (útil em testes).
 */
export function resetResendClient(): void {
  client = null
}

// ─── Provider ───────────────────────────────────────────────

export const resendEmailProvider: EmailProvider = {
  name: 'resend',

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const { from, replyTo } = getConfig()
    const r = getClient()

    const payload: Record<string, unknown> = {
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }

    if (input.text) {
      payload.text = input.text
    }

    if (replyTo) {
      payload.reply_to = replyTo
    }

    const opts: Record<string, unknown> = {}
    if (input.idempotencyKey) {
      opts.idempotencyKey = input.idempotencyKey
    }

    const response = await r.emails.send(payload as any, opts as any)

    if (response.error) {
      const sanitized = sanitizeResendError(response.error)
      return { kind: 'failed', error: sanitized }
    }

    const providerMessageId = response.data?.id
    if (!providerMessageId) {
      return { kind: 'failed', error: 'Resend não devolveu ID da mensagem.' }
    }

    return { kind: 'sent', providerMessageId }
  },
}

// ─── Sanitização ────────────────────────────────────────────

function sanitizeResendError(error: { message: string; statusCode: number | null; name: string }): string {
  // Apenas mensagem + código — nunca secrets, stack, headers
  return `Resend: ${error.name}${error.statusCode ? ` (${error.statusCode})` : ''} — ${error.message.slice(0, 300)}`
}

/**
 * Verifica se o provider Resend está configurado (sem lançar).
 */
export function isResendConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM
  return !!(apiKey?.trim() && emailFrom?.trim())
}