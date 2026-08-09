/**
 * fake.ts — Fake EmailProvider para testes
 *
 * Nunca envia emails reais. Usado em testes unitários e como
 * provider default em dev até escolha de provider real.
 */
import type { EmailProvider, EmailSendInput, EmailSendResult } from '../email-provider'

export const fakeEmailProvider: EmailProvider = {
  name: 'fake',

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    // Simula latência de rede
    await new Promise((r) => setTimeout(r, 5))
    return { kind: 'sent', providerMessageId: `fake-${Date.now()}` }
  },
}

/**
 * Provider que falha sempre — para testar cenários de erro.
 */
export const failingEmailProvider: EmailProvider = {
  name: 'failing',

  async send(_input: EmailSendInput): Promise<EmailSendResult> {
    await new Promise((r) => setTimeout(r, 5))
    return { kind: 'failed', error: 'Simulated provider failure' }
  },
}