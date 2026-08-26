/**
 * localizeLink — Prepends or replaces locale prefix on internal links.
 *
 * Rules:
 *   - null/undefined/empty → null
 *   - http://, https://, mailto:, tel:, # → returned as-is (external/special)
 *   - /{locale}/... or /{locale} → replaces existing locale prefix with current
 *   - /... (internal without locale) → prepends /{locale}
 *   - anything else → returned as-is (relative paths, etc.)
 */
const LOCALE_PREFIX = /^\/(pt|en|es|it|de)(\/|$)/

export function localizeLink(
  link: string | null | undefined,
  locale: string,
): string | null {
  if (!link) return null

  // External / special protocols — pass through
  if (
    link.startsWith('http://') ||
    link.startsWith('https://') ||
    link.startsWith('mailto:') ||
    link.startsWith('tel:') ||
    link === '#'
  ) {
    return link
  }

  // Strip existing locale prefix if present, then prepend current locale
  const stripped = link.replace(LOCALE_PREFIX, '/')
  const normalized = stripped === '/' ? '' : stripped
  return `/${locale}${normalized}`
}