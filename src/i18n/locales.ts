export const locales = ['pt', 'en', 'es', 'it', 'de'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'pt'

const localeSet = new Set<string>(locales)

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && localeSet.has(value)
}