/**
 * email-provider.ts — Interface abstracta para envio de emails
 *
 * Provider opera FORA de DB transactions. O resultado é persistido
 * separadamente pelo processador.
 */
export interface EmailSendInput {
  /** Email do destinatário */
  to: string
  /** Assunto */
  subject: string
  /** Corpo HTML */
  html: string
  /** Corpo texto simples (opcional) */
  text?: string
  /** Chave de idempotência para o provider (se suportado) */
  idempotencyKey?: string
}

export interface EmailSendResult {
  kind: 'sent' | 'failed'
  providerMessageId?: string
  error?: string
}

export interface EmailProvider {
  readonly name: string
  send(input: EmailSendInput): Promise<EmailSendResult>
}