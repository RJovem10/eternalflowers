/**
 * email-provider-errors.ts — Erros tipados para o sistema de providers
 */

/**
 * Provider não configurado (env vars em falta).
 * Usado pelo factory e pelo processador para saltar notificações
 * silenciosamente sem as marcar como failed.
 */
export class EmailProviderNotConfiguredError extends Error {
  readonly name = 'EmailProviderNotConfiguredError'

  constructor(msg?: string) {
    super(msg || 'Email provider não está configurado. Verifique EMAIL_PROVIDER e credenciais.')
  }
}

/**
 * Erro genérico do provider de email.
 * Mensagens sanitizadas — sem secrets, stack traces ou headers.
 */
export class EmailProviderError extends Error {
  readonly name = 'EmailProviderError'

  constructor(msg: string) {
    super(msg)
  }
}