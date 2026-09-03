/**
 * Builds the per-store Google Fonts stylesheet URL.
 *
 * The weights requested here are always derived from the axes snapshot stored
 * on the tenant, never from free input. That is what makes one specific failure
 * unreachable rather than merely unlikely: Google's css2 endpoint answers 400
 * Bad Request for a weight a family does not have, and a rejected stylesheet
 * takes down the entire font — every visitor silently drops to system-ui —
 * rather than just the missing weight.
 */
import type { FontSlot } from './types'

/**
 * The stylesheet origin. Exported as a constant so src/lib/csp.test.ts can
 * derive the host it has to admit from the code that actually emits it, rather
 * than restating the literal in two places that can drift apart.
 */
export const GOOGLE_FONTS_CSS2_BASE = 'https://fonts.googleapis.com/css2'

/** The weight range the storefront's blocks actually use (300 = font-light … 800 = font-extrabold). */
const RANGE_MIN = 300
const RANGE_MAX = 800

/**
 * Which weights a static family gets, in priority order, capped at four.
 *
 * 400 and 700 first because they are body and bold; then 600 and 500, which are
 * the next two most-used utility classes in the blocks (87 font-semibold, 77
 * font-medium). The order is fixed rather than derived from the merchant's own
 * weight selects, so the same family always produces a byte-identical URL and
 * stays cacheable across every store that uses it.
 */
export const STATIC_WEIGHT_PRIORITY = ['400', '700', '600', '500', '300', '800']
const STATIC_WEIGHT_CAP = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * The single family-name encoder for the css2 endpoint's `family=` param.
 *
 * Not `family.replace(/ /g, '+')` — that leaves `&` unencoded and splits the
 * query string. `encodeURIComponent` first, then turn the escaped space
 * (`%20`) into `+`, which is css2's preferred (and more compact) space
 * encoding but not a requirement — `%20` also works. Exported so every
 * caller that builds a css2 URL, including the admin font picker's preview
 * link, shares this one encoder rather than growing a second copy that is
 * only safe because of the FAMILY_NAME ingestion gate in catalog.ts.
 */
export function familyParam(family: string): string {
  return encodeURIComponent(family).replace(/%20/g, '+')
}

/** The `wght@…` fragment for one slot, or null if it resolves to nothing. */
function weightSpec(slot: FontSlot): string | null {
  if (slot.axes.variable) {
    const min = clamp(RANGE_MIN, slot.axes.min, slot.axes.max)
    const max = clamp(RANGE_MAX, slot.axes.min, slot.axes.max)
    return min === max ? `${min}` : `${min}..${max}`
  }
  const available = new Set(slot.axes.weights)
  const chosen = STATIC_WEIGHT_PRIORITY.filter((w) => available.has(w)).slice(0, STATIC_WEIGHT_CAP)
  if (chosen.length === 0) return null
  // css2 requires the weight list in ascending order.
  return chosen.sort((a, b) => Number(a) - Number(b)).join(';')
}

export function buildFontHref(slots: FontSlot[]): string | null {
  const seen = new Set<string>()
  const params: string[] = []

  for (const slot of slots) {
    if (!slot.family || seen.has(slot.family)) continue
    seen.add(slot.family)
    const spec = weightSpec(slot)
    if (!spec) continue
    params.push(`family=${familyParam(slot.family)}:wght@${spec}`)
  }

  if (params.length === 0) return null
  return `${GOOGLE_FONTS_CSS2_BASE}?${params.join('&')}&display=swap`
}
