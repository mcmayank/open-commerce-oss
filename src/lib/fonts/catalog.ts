/**
 * The single owner of the Google Fonts dependency.
 *
 * Nothing outside src/lib/fonts/ calls Google or parses its response. The
 * catalog is fetched live when GOOGLE_FONTS_API_KEY is set and cached for 24
 * hours; on a missing key, a thrown fetch, or a non-200 it falls back to the
 * committed snapshot. The fallback is what keeps the free self-host build whole
 * — a self-hoster with no Google Cloud account still gets a working picker.
 */
import type { CatalogFamily, FontAxes, FontCategory } from './types'
import snapshot from './snapshot.json'

const ENDPOINT = 'https://www.googleapis.com/webfonts/v1/webfonts'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const CATEGORIES: FontCategory[] = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace']

/**
 * The safe shape of a Google Fonts family name: it must start with a letter or
 * digit, and contain only letters, digits, spaces and hyphens after that (e.g.
 * "Source Serif 4", "IBM Plex Sans Arabic"). No quotes, backslashes, braces,
 * semicolons, or other characters that mean something in CSS or a URL.
 *
 * This exists so that `resolveFamily` in validate.ts can be the *sole* gate for
 * both sinks a family name reaches — a URL query parameter and a raw CSS
 * font-family declaration. An exact-match allowlist against the catalog is only
 * as safe as the catalog itself: if `fetchCatalog()` can return an entry with a
 * quote or brace in its name (Google's live API is not under this codebase's
 * control), that entry would sail through the allowlist and land unescaped in
 * the CSS sink. Filtering the catalog to this shape at ingestion — for both the
 * live API and the committed snapshot — means an unsafe name can never enter
 * the catalog in the first place, so the allowlist doesn't have to trust
 * Google to stay well-behaved.
 */
const FAMILY_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]*$/

/** Drop any entry whose family name doesn't match FAMILY_NAME. See its docblock. */
function filterSafeFamilies(families: CatalogFamily[]): CatalogFamily[] {
  return families.filter((f) => FAMILY_NAME.test(f.family))
}

/**
 * Google spells the 400 weight "regular" and italics as "italic" / "700italic".
 * Normalising once here means every later consumer — the URL builder, the
 * picker, the validation hook — works with plain numeric strings, and the
 * "which weights does this family have" question has exactly one answer shape.
 *
 * Italics collapse to a single boolean rather than a per-weight list because
 * the storefront requests no italics at all today; the flag exists so that
 * decision is reversible without a migration.
 */
export function normalizeVariants(variants: string[]): { weights: string[]; hasItalic: boolean } {
  const weights = new Set<string>()
  let hasItalic = false
  for (const variant of variants) {
    if (variant.endsWith('italic')) {
      hasItalic = true
      const roman = variant.slice(0, -'italic'.length)
      weights.add(roman === '' ? '400' : roman)
      continue
    }
    weights.add(variant === 'regular' ? '400' : variant)
  }
  return {
    weights: [...weights].sort((a, b) => Number(a) - Number(b)),
    hasItalic,
  }
}

/** Reduce a catalog entry to the small snapshot persisted on a store. */
export function toAxes(entry: CatalogFamily): FontAxes {
  const common = { category: entry.category, hasItalic: entry.hasItalic }
  return entry.variable
    ? { ...common, variable: true, min: entry.variable.min, max: entry.variable.max }
    : { ...common, variable: false, weights: entry.weights }
}

interface GoogleItem {
  family: string
  category: string
  variants: string[]
  subsets: string[]
  axes?: { tag: string; start: number; end: number }[]
}

function toCatalogFamily(item: GoogleItem): CatalogFamily {
  const { weights, hasItalic } = normalizeVariants(item.variants)
  const wght = item.axes?.find((a) => a.tag === 'wght')
  return {
    family: item.family,
    category: CATEGORIES.includes(item.category as FontCategory)
      ? (item.category as FontCategory)
      : 'sans-serif',
    weights,
    hasItalic,
    variable: wght ? { min: wght.start, max: wght.end } : null,
    subsets: item.subsets ?? [],
  }
}

let cache: { at: number; families: CatalogFamily[] } | null = null

/** Test seam — the cache is module state, so a suite must be able to clear it. */
export function __resetCatalogCacheForTests(): void {
  cache = null
}

export async function fetchCatalog(): Promise<CatalogFamily[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.families

  const key = process.env.GOOGLE_FONTS_API_KEY
  if (key) {
    try {
      const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&sort=popularity&capability=VF`
      const res = await fetch(url)
      if (res.ok) {
        const body = (await res.json()) as { items?: GoogleItem[] }
        const families = filterSafeFamilies((body.items ?? []).map(toCatalogFamily))
        if (families.length > 0) {
          cache = { at: Date.now(), families }
          return families
        }
      }
    } catch {
      /* fall through to the snapshot — see the module docblock */
    }
  }

  const families = filterSafeFamilies(snapshot as CatalogFamily[])
  cache = { at: Date.now(), families }
  return families
}
