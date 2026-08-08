/**
 * ctt.ts — CttShippingProvider (stub)
 *
 * Provider preparado estruturalmente para integração futura com CTT Expresso.
 *
 * A implementação real depende de:
 * - Contrato CTT Expresso
 * - Acesso API / Web Services
 * - Documentação oficial
 * - Credenciais QA / produção
 *
 * Enquanto não existir configuração, quote() lança
 * ShippingProviderNotConfiguredError.
 */

import type { ShippingQuote, ShippingQuoteInput } from '../shipping-types'
import type { ShippingProvider } from '../shipping'
import { ShippingProviderNotConfiguredError } from '../shipping-types'

export const cttProviderId = 'ctt'

export const cttProvider: ShippingProvider = {
  id: cttProviderId,

  async quote(_input: ShippingQuoteInput): Promise<ShippingQuote[]> {
    throw new ShippingProviderNotConfiguredError(
      'CTT Expresso não está configurado. ' +
      'Necessário: contrato CTT Expresso, acesso API/Web Services, ' +
      'documentação oficial e credenciais QA/produção.',
    )
  },
}