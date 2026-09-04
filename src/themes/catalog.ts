import type { ThemeMeta } from './types'
import { sdBakeryMeta } from './sd-bakery/meta'
import { editorialMeta } from './editorial/meta'

/**
 * Pure, server- and client-safe registry of theme *metadata* (no components).
 *
 * This is the single source of truth for the template picker: the Payload
 * `storefrontTheme` select options, entitlement gating, and the customization
 * field schemas all derive from here. The component registry (index.ts) spreads
 * this metadata onto the actual view components — importing index.ts pulls in
 * server components, so anything running in the Payload config context or a
 * client field UI must import THIS module instead.
 */

/** The built-in, always-available storefront (no theme override). */
export const DEFAULT_THEME_SLUG = 'default'

const defaultMeta: ThemeMeta = {
  slug: DEFAULT_THEME_SLUG,
  label: 'Default',
  entitlement: 'free',
  description: 'The standard storefront, styled by your brand colors and fonts.',
  fields: [],
}

/** Every selectable template, including the built-in Default. */
export const themeCatalog: readonly ThemeMeta[] = [defaultMeta, editorialMeta, sdBakeryMeta]

/** Look up a template's metadata by slug (null for unknown / missing). */
export function getThemeMeta(slug: string | null | undefined): ThemeMeta | null {
  if (!slug) return null
  return themeCatalog.find((t) => t.slug === slug) ?? null
}

/** Payload select options derived from the catalog — no hardcoded duplication. */
export function themeSelectOptions(): { label: string; value: string }[] {
  return themeCatalog.map((t) => ({
    label: t.entitlement === 'premium' ? `${t.label} (premium)` : t.label,
    value: t.slug,
  }))
}
