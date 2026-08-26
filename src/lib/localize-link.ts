/**
 * localizeLink — Prepends or replaces locale prefix on internal links.
 *
 * Rules:
 *   - null/undefined/empty → null
 *   - http://, https://, mailto:, tel:, #... → returned as-is (external/special)
 *   - anything not starting with "/" → returned as-is (bare word, relative)
 *   - /{locale}/... or /{locale} → replaces existing locale prefix with current
 *   - /... (internal without locale) → prepends /{locale}
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
    link.startsWith('#')
  ) {
    return link
  }

  // Non-absolute paths (no leading "/") — pass through unchanged
  if (!link.startsWith('/')) {
    return link
  }

  // Strip existing locale prefix, then prepend current locale
  const stripped = link.replace(LOCALE_PREFIX, '/')
  const normalized = stripped === '/' ? '' : stripped
  return `/${locale}${normalized}`
}