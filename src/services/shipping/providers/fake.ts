/**
 * fake.ts — FakeShippingProvider para testes de checkout finalization
 *
 * Provider fictício que devolve sempre uma cotação fixa.
 * Usado em ambiente de desenvolvimento/teste enquanto a CTT real não estiver configurada.
 */

import type { ShippingQuote, ShippingQuoteInput } from '../shipping-types'
import type { ShippingProvider } from '../shipping'

export const fakeProviderId = 'fake'

export const fakeProvider: ShippingProvider = {
  id: fakeProviderId,

  async quote(_input: ShippingQuoteInput): Promise<ShippingQuote[]> {
    return [
      {
        provider: fakeProviderId,
        serviceCode: 'STANDARD',
        serviceName: 'Standard Delivery (Fake)',
        amount: 7.90,
        currency: 'EUR',
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
      },
    ]
  },
}