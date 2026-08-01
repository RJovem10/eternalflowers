import { locales } from './dictionaries'
import type { Locale } from './dictionaries'

const supportedLocaleSet = new Set<string>(locales as readonly string[])

export function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && supportedLocaleSet.has(value))
}

export function getLocaleFromPathname(pathname: string | null): Locale {
  const candidate = pathname?.split('/')[1]
  return isLocale(candidate) ? candidate : 'pt'
}