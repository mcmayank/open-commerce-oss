/**
 * Storefront theme contract.
 *
 * A theme is a pure DATA PRESET over the shared storefront — design tokens,
 * per-block section color schemes, and chrome layout variants. There are no
 * bespoke per-theme view components: every route renders the shared components,
 * restyled by the active theme's preset (see src/lib/theme-tokens.ts,
 * src/blocks/lib/colorScheme.ts, src/themes/layout.ts).
 *
 * Declarative customization schema — see catalog.ts / resolve.ts.
 *
 * A theme declares the fields a tenant may customize; the dashboard renders a
 * form from this list and the storefront reads validated values back out. Kept
 * pure data (no React) so it can be imported from the Payload server config
 * (Tenants.ts) and from 'use client' field UIs alike.
 */
export type ThemeEntitlement = 'free' | 'premium'

export type ThemeFieldType =
  | 'color'
  | 'text'
  | 'textarea'
  | 'select'
  | 'media'
  | 'boolean'
  | 'number'

export interface ThemeFieldDef {
  name: string
  type: ThemeFieldType
  label: string
  description?: string
  /** Applied when the stored value is missing or invalid (not for `media`). */
  default?: string | number | boolean
  /** Required for `select`; the stored value must be one of these. */
  options?: { label: string; value: string }[]
  /** `number` bounds — the resolved value is clamped into [min, max]. */
  min?: number
  max?: number
  /** `text` / `textarea` — the resolved value is truncated to this length. */
  maxLength?: number
}

/**
 * Pure, server- and client-safe theme metadata. Lives in `<theme>/meta.ts`
 * (never importing fonts.ts or any .tsx) and is aggregated by catalog.ts.
 */
export interface ThemeMeta {
  slug: string
  label: string
  entitlement: ThemeEntitlement
  /** Static path under /public used by the picker / preview thumbnail. */
  previewImage?: string
  description?: string
  fields: readonly ThemeFieldDef[]
  /** Design-token preset applied over the defaults (Slice E). The tenant's own
   *  color/font settings still override these. See src/lib/theme-tokens.ts. */
  tokens?: Partial<import('@/lib/theme-tokens').ThemeTokens>
  /** Per-block-type section color scheme overrides (Slice E), layered over
   *  BLOCK_DEFAULT_SCHEME. See src/blocks/lib/colorScheme.ts. */
  blockSchemes?: Record<string, import('@/blocks/lib/colorScheme').SectionScheme>
  /** Structural layout variants for the shared chrome (Slice D). Omit for the
   *  standard layout. See src/themes/layout.ts. */
  layout?: Partial<import('./layout').ThemeLayout>
}

/** A registered theme. Now purely `ThemeMeta` (a data preset) — kept as a named
 *  type for the registry and call sites. */
export type StorefrontTheme = ThemeMeta
