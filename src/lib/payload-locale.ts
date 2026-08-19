import type { Locale } from '@/i18n/dictionaries'

/**
 * Retorna opções de locale e fallback para queries Payload Local API.
 *
 * O Payload 3.86 já tem fallback: true e defaultLocale: 'pt' na config,
 * mas passar locale e fallbackLocale explicitamente garante que:
 *  - o conteúdo seja devolvido no locale pedido quando existe tradução;
 *  - quando não existe, o Payload faz fallback para PT (defaultLocale);
 *  - nunca cai noutro locale por acidente.
 */
export function payloadLocaleOptions(locale: Locale) {
  return {
    locale,
    fallbackLocale: 'pt' as const,
  }
}

/**
 * Query sem fallback de locale — retorna apenas o conteúdo
 * que existe EXACTAMENTE no locale pedido (null se não existir).
 *
 * Útil para verificar se um campo localizado (ex: description) tem
 * realmente um valor no locale pedido, sem ficar com o fallback PT.
 */
export function payloadLocaleWithoutFallback(locale: Locale) {
  return {
    locale,
    fallbackLocale: false as const,
  }
}