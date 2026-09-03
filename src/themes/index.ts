import type { StorefrontTheme } from './types'
import { sdBakeryTheme } from './sd-bakery'
import { editorialTheme } from './editorial'

export type { StorefrontTheme } from './types'

const registry: Record<string, StorefrontTheme> = {
  'sd-bakery': sdBakeryTheme,
  editorial: editorialTheme,
}

/**
 * Resolve a registered theme by its raw slug. Returns null for 'default',
 * empty/missing, or unknown slugs — callers render the default storefront JSX.
 * Used directly by the preview flow, where the active slug can come from a
 * preview cookie rather than the persisted tenant record.
 */
export function getStorefrontThemeBySlug(
  slug: string | null | undefined,
): StorefrontTheme | null {
  if (!slug || slug === 'default') return null
  return registry[slug] ?? null
}

/** Resolve a store's persisted premium storefront theme. */
export function getStorefrontTheme(tenant: {
  storefrontTheme?: string | null
}): StorefrontTheme | null {
  return getStorefrontThemeBySlug(tenant.storefrontTheme)
}
