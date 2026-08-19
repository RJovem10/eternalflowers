/**
 * country-whitelist.ts — Canonical shipping-destination whitelist
 *
 * Used by both frontend (checkout country selector) and backend
 * (server-side country validation). Single source of truth so the
 * two never drift apart.
 *
 * Eternal Flowers ships ONLY to these 32 approved commercial-European
 * destinations.
 *
 * EU-27:
 *   AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT,
 *   LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE
 *
 * Non-EU:
 *   GB (United Kingdom)
 *   CH (Switzerland)
 *   NO (Norway)
 *   IS (Iceland)
 *   LI (Liechtenstein)
 *
 * Total: 32 countries.
 */

/**
 * Canonical whitelist as a Set of ISO 3166-1 alpha-2 codes (uppercase).
 * Use for fast server-side membership checks.
 */
export const SHIPPING_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE',
  'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
  'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'CH', 'NO', 'IS', 'LI',
])

/**
 * Display-friendly label map for the frontend country selector.
 */
export const SHIPPING_COUNTRY_LABELS: Record<string, string> = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czech Republic',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
  GB: 'United Kingdom',
  CH: 'Switzerland',
  NO: 'Norway',
  IS: 'Iceland',
  LI: 'Liechtenstein',
}

/** Convenience array of [code, label] tuples for the frontend selector. */
export const SHIPPING_COUNTRIES: ReadonlyArray<[string, string]> =
  Object.entries(SHIPPING_COUNTRY_LABELS) as [string, string][]

/**
 * Check if a country code is a valid shipping destination.
 * Accepts uppercase and lowercase.
 */
export function isShippingDestination(countryCode: string): boolean {
  return SHIPPING_COUNTRY_CODES.has(countryCode.toUpperCase())
}