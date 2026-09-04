/**
 * Theme token engine (Slice A of the theming roadmap).
 *
 * A theme is a data preset whose tokens are emitted as CSS variables scoped to
 * the storefront root; all shared blocks/components consume them. This module is
 * pure (no React) so it can be unit-tested and imported anywhere.
 *
 * Back-compat: the six variable names the current storefront already uses
 * (`--color-primary/-accent/-surface/-text`, `--font-body`, `--radius-button`)
 * are a subset of the expanded set and keep their exact default values, so
 * token-native blocks render identically until later slices adopt the new vars.
 */

import type { FontCategory } from '@/lib/fonts/types'

/** A theme's resolved design tokens — every value is a concrete CSS string. */
export interface ThemeTokens {
  colorBg: string
  colorSurface: string
  colorSurfaceAlt: string
  colorText: string
  colorTextMuted: string
  colorHeading: string
  colorPrimary: string
  colorPrimaryContrast: string
  colorAccent: string
  colorBorder: string
  fontBody: string
  fontHeading: string
  /** Third font role — the "span alternative font" a block's `font: 'display'`
   *  style control resolves to (`--font-display`). Font-agnostic: whatever
   *  family the merchant picks here, it's just a third configurable slot. */
  fontDisplay: string
  /** Optional global font-weights. When set, StoreTheme forces body / h1–h6 to
   *  these weights (overriding block utility classes) for a consistent type
   *  system. Unset → blocks keep their own weights. */
  fontBodyWeight?: string
  fontHeadingWeight?: string
  radiusSm: string
  radiusMd: string
  radiusLg: string
  radiusButton: string
  radiusCard: string
  spaceSection: string
  spaceGap: string
  containerWidth: string
  shadowCard: string
}

/**
 * Tenant-editable legacy theme settings (StoreSettings.theme group).
 *
 * `''` is the admin's inherit sentinel and is accepted here, but is never
 * persisted — text columns store it as-is and read back as falsy, while the two
 * enum columns are normalised to NULL in a field `beforeChange`. All three
 * spellings mean inherit.
 *
 * `fontFamilyAxes`/`headingFontAxes` are typed as `unknown`, not `FontAxes`,
 * because that is the honest type: `src/payload-types.ts` generates these two
 * columns as generic Payload JSON (`{[k: string]: unknown} | unknown[] |
 * string | number | boolean | null`), and callers reach this type via an `as
 * LegacyThemeSettings` cast rather than a runtime check. A narrower type here
 * would be unverified, not enforced. `fontStack` narrows the value itself at
 * its one read site and degrades to a sans fallback for anything that isn't a
 * recognisable `FontAxes` shape — see `categoryOf` below.
 */
export type LegacyThemeSettings = {
  primaryColor?: string | null
  accentColor?: string | null
  backgroundColor?: string | null
  textColor?: string | null
  fontFamily?: string | null
  fontFamilyAxes?: unknown
  headingFont?: string | null
  headingFontAxes?: unknown
  displayFont?: string | null
  displayFontAxes?: unknown
  headingWeight?: string | null
  bodyWeight?: string | null
  buttonRadius?: string | null
} | null | undefined

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const hex = (v: string | null | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback)

/** The native stack, used for the `system` sentinel. Unchanged from the old FONTS.system. */
export const SYSTEM_FONT_STACK = 'system-ui, -apple-system, sans-serif'

/**
 * What follows the merchant's family in the CSS stack, per catalog category.
 *
 * The point is that the fallback is *shaped like the font* — a serif family
 * falling back to a sans while the webfont loads is a visible reflow, and with
 * display=swap that fallback is what visitors read first.
 */
const CATEGORY_FALLBACK: Record<FontCategory, string> = {
  'sans-serif': 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  monospace: 'ui-monospace, monospace',
  display: 'system-ui, sans-serif',
  handwriting: 'system-ui, sans-serif',
}

const FONT_CATEGORIES: ReadonlySet<string> = new Set<FontCategory>([
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
])

/**
 * Narrow an `unknown` axes value down to a `FontCategory`, defaulting to
 * `sans-serif` for anything that isn't a `{ category: <known category> }`
 * shape — a missing snapshot, a legacy row, a string, an array, whatever a
 * generic JSON column can hold. This is graceful degradation, not validation:
 * a malformed value never throws and never produces a broken CSS stack, it
 * just loses the category-specific fallback tail.
 */
function categoryOf(axes: unknown): FontCategory {
  if (
    axes &&
    typeof axes === 'object' &&
    !Array.isArray(axes) &&
    FONT_CATEGORIES.has((axes as { category?: unknown }).category as string)
  ) {
    return (axes as { category: FontCategory }).category
  }
  return 'sans-serif'
}

/**
 * Build the CSS font stack for one slot.
 *
 * The family name is quoted, and is safe to interpolate for a two-link reason,
 * both of which must hold: it passed the exact-match allowlist in
 * src/lib/fonts/validate.ts, and that allowlist matches against a catalog whose
 * entries are shape-gated at ingestion (FAMILY_NAME in src/lib/fonts/catalog.ts),
 * so no name carrying a quote or brace can be in it in the first place. This
 * function is not the security boundary and must not be treated as one — do not
 * add escaping here, and do not weaken either link upstream.
 */
export function fontStack(family: string | null | undefined, axes: unknown, fallback: string): string {
  if (!family) return fallback
  if (family === 'system') return SYSTEM_FONT_STACK
  return `"${family}", ${CATEGORY_FALLBACK[categoryOf(axes)]}`
}

/** Radius enum → CSS length (mirrors StoreSettings.theme.buttonRadius options). */
const RADII: Record<string, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
}

/**
 * The built-in Default theme preset — its six legacy tokens match the current
 * storefront's defaults exactly, so the Default theme is visually unchanged.
 */
export const DEFAULT_TOKENS: ThemeTokens = {
  colorBg: '#ffffff',
  colorSurface: '#ffffff',
  colorSurfaceAlt: '#f9fafb',
  colorText: '#111827',
  colorTextMuted: '#6b7280',
  colorHeading: '#111827',
  colorPrimary: '#111827',
  colorPrimaryContrast: '#ffffff',
  colorAccent: '#2563eb',
  colorBorder: '#e5e7eb',
  fontBody: SYSTEM_FONT_STACK,
  fontHeading: SYSTEM_FONT_STACK,
  fontDisplay: SYSTEM_FONT_STACK,
  radiusSm: '0.25rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusButton: '0.5rem',
  radiusCard: '0.75rem',
  spaceSection: '4rem',
  spaceGap: '1.5rem',
  containerWidth: '80rem',
  shadowCard: '0 1px 3px rgba(0, 0, 0, 0.1)',
}

/**
 * Overlay a tenant's legacy theme settings onto a theme preset. Only the six
 * settings the tenant can edit today are applied; invalid/missing values keep
 * the preset's value. Later slices add richer per-token overrides.
 */
export function resolveTokens(preset: ThemeTokens, settings: LegacyThemeSettings): ThemeTokens {
  const fontHeading = fontStack(settings?.headingFont, settings?.headingFontAxes, preset.fontHeading)
  return {
    ...preset,
    colorPrimary: hex(settings?.primaryColor, preset.colorPrimary),
    colorAccent: hex(settings?.accentColor, preset.colorAccent),
    colorSurface: hex(settings?.backgroundColor, preset.colorSurface),
    colorText: hex(settings?.textColor, preset.colorText),
    // Legacy settings have no separate heading color — headings follow body text
    // so a custom text color never leaves headings mismatched.
    colorHeading: hex(settings?.textColor, preset.colorHeading),
    fontBody: fontStack(settings?.fontFamily, settings?.fontFamilyAxes, preset.fontBody),
    fontHeading,
    // Unconfigured display role falls back to the resolved heading font (not
    // the preset's own fontDisplay) — a merchant who never touches this slot
    // gets their heading font on the block-style vocabulary's `font: 'display'`
    // control, never an unrelated preset default.
    fontDisplay: fontStack(settings?.displayFont, settings?.displayFontAxes, fontHeading),
    fontBodyWeight: settings?.bodyWeight || preset.fontBodyWeight,
    fontHeadingWeight: settings?.headingWeight || preset.fontHeadingWeight,
    radiusButton: settings?.buttonRadius
      ? (RADII[settings.buttonRadius] ?? preset.radiusButton)
      : preset.radiusButton,
  }
}

/**
 * Layer a theme's (partial) token preset over the built-in defaults to get a
 * complete token set. A theme preset only needs to specify what it changes.
 */
export function presetTokens(preset: Partial<ThemeTokens> | null | undefined): ThemeTokens {
  return preset ? { ...DEFAULT_TOKENS, ...preset } : DEFAULT_TOKENS
}

/** Emit the full CSS-variable map for a resolved token set. */
export function buildThemeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--color-bg': tokens.colorBg,
    '--color-surface': tokens.colorSurface,
    '--color-surface-alt': tokens.colorSurfaceAlt,
    '--color-text': tokens.colorText,
    '--color-text-muted': tokens.colorTextMuted,
    '--color-heading': tokens.colorHeading,
    '--color-primary': tokens.colorPrimary,
    '--color-primary-contrast': tokens.colorPrimaryContrast,
    '--color-accent': tokens.colorAccent,
    '--color-border': tokens.colorBorder,
    '--font-body': tokens.fontBody,
    '--font-heading': tokens.fontHeading,
    '--font-display': tokens.fontDisplay,
    '--radius-sm': tokens.radiusSm,
    '--radius-md': tokens.radiusMd,
    '--radius-lg': tokens.radiusLg,
    '--radius-button': tokens.radiusButton,
    '--radius-card': tokens.radiusCard,
    '--space-section': tokens.spaceSection,
    '--space-gap': tokens.spaceGap,
    '--container-width': tokens.containerWidth,
    '--shadow-card': tokens.shadowCard,
  }
}
