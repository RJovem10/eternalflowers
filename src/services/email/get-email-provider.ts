/**
 * get-email-provider.ts — Factory para resolver o provider de email
 *
 * Usa EMAIL_PROVIDER env var (default: 'fake' em dev/test).
 *
 * Valores conhecidos:
 *   'resend' → Resend provider (requer RESEND_API_KEY + EMAIL_FROM)
 *
 * Valores desconhecidos → EmailProviderNotConfiguredError.
 *
 * Fake provider APENAS em testes — nunca em runtime via env.
 */
import type { EmailProvider } from './email-provider'
import { EmailProviderNotConfiguredError } from './email-provider-errors'

/**
 * Devolve o provider de email configurado via ambiente.
 *
 * Lança EmailProviderNotConfiguredError se:
 * - EMAIL_PROVIDER for desconhecido/vazio
 * - As env vars necessárias para o provider estiverem ausentes
 */
export async function getConfiguredEmailProvider(): Promise<EmailProvider> {
  const providerName = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase()

  if (!providerName) {
    throw new EmailProviderNotConfiguredError(
      'EMAIL_PROVIDER não definido. Defina EMAIL_PROVIDER=resend ou outro provider suportado.',
    )
  }

  if (providerName === 'resend') {
    // Lazy-import do provider Resend (só carrega quando necessário)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const { resendEmailProvider } = await import('./providers/resend')
    return resendEmailProvider
  }

  throw new EmailProviderNotConfiguredError(
    `EMAIL_PROVIDER desconhecido: "${providerName}". Valores suportados: resend.`,
  )
}