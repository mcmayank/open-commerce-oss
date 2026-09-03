/**
 * The single validation choke point for merchant-chosen font families.
 *
 * This is an exact-match allowlist against the catalog — not a regex, not a
 * sanitizer, not an escape function. A family name reaches TWO sinks: a URL
 * query parameter (src/lib/fonts/url.ts) and a CSS font-family declaration
 * inside the storefront's nonce'd <style> tag (StoreTheme). Escaping would have
 * to be correct twice, in two different grammars; an allowlist closes both at
 * once — and it is the *sole* gate for both, with no second check at the CSS
 * sink. That's only sound because the catalog this allowlist matches against is
 * itself shape-gated at ingestion (FAMILY_NAME in catalog.ts): both the live
 * Google API response and the committed snapshot are filtered so that no entry
 * with a quote, brace, or other CSS/URL-meaningful character can ever reach
 * this allowlist. Do not add a second sanitizer here — one gate, in one place,
 * stated clearly.
 *
 * It lives here rather than in the admin picker because the picker is a
 * convenience. A direct REST/GraphQL write that never opens the admin hits the
 * same Payload hook, which is what actually protects the storefront — the same
 * reasoning as sanitizeThemeCustomizations in src/lib/theme-customizations.ts.
 */
import { fetchCatalog, toAxes } from './catalog'
import type { FontAxes } from './types'

/** Reserved sentinel meaning "the native system stack". Never sent to Google. */
export const SYSTEM_FONT_VALUE = 'system'

export async function resolveFamily(
  raw: unknown,
): Promise<{ family: string | null; axes: FontAxes | null }> {
  if (raw === null || raw === undefined || raw === '') return { family: null, axes: null }
  if (raw === SYSTEM_FONT_VALUE) return { family: SYSTEM_FONT_VALUE, axes: null }

  if (typeof raw !== 'string') {
    throw new Error('That is not a Google Font. Pick a family from the list.')
  }

  const catalog = await fetchCatalog()
  const match = catalog.find((entry) => entry.family === raw)
  if (!match) {
    throw new Error(`“${raw}” is not a Google Font. Pick a family from the list.`)
  }
  return { family: match.family, axes: toAxes(match) }
}
