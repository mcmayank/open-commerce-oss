/**
 * Theme layout variants (Slice D of the theming roadmap).
 *
 * A theme preset can pick structural variants for the shared chrome — a centered
 * masthead header, a minimal footer — on top of the token/scheme styling. Pure
 * data so it can be resolved anywhere; the shared Header/Footer render the
 * variant, and a theme preset supplies the choice (wired in Slice E).
 */
export type HeaderLayout = 'standard' | 'centered' | 'editorial'
export type FooterLayout = 'standard' | 'minimal'

export interface ThemeLayout {
  header: HeaderLayout
  footer: FooterLayout
}

export const DEFAULT_LAYOUT: ThemeLayout = { header: 'standard', footer: 'standard' }

/** Resolve a theme's (possibly partial) layout to a complete one. */
export function resolveThemeLayout(layout: Partial<ThemeLayout> | null | undefined): ThemeLayout {
  return {
    header: layout?.header ?? DEFAULT_LAYOUT.header,
    footer: layout?.footer ?? DEFAULT_LAYOUT.footer,
  }
}

/** A tenant's header-layout choice: an explicit variant, or "theme" to defer to the theme default. */
export type HeaderLayoutSetting = HeaderLayout | 'theme'

/**
 * Effective header layout for a store: the tenant's explicit choice when set to a real
 * variant, otherwise the theme's default. Unknown/null/undefined/"theme" → theme default,
 * so existing stores (NULL column) render exactly as before.
 */
export function resolveHeaderLayout(
  themeHeader: HeaderLayout,
  setting: HeaderLayoutSetting | null | undefined,
): HeaderLayout {
  if (setting === 'standard' || setting === 'centered' || setting === 'editorial') {
    return setting
  }
  return themeHeader
}

export type LogoSize = 'small' | 'medium' | 'large' | 'xlarge'

// Full literal class strings so Tailwind v4's source scanner emits their CSS.
const LOGO_SIZE_CLASSES: Record<LogoSize, string> = {
  small: 'h-8 md:h-10 w-auto object-contain',
  medium: 'h-11 md:h-14 w-auto object-contain',
  large: 'h-14 md:h-20 w-auto object-contain',
  xlarge: 'h-16 md:h-24 w-auto object-contain',
}

/** Full logo <img> class string for a tenant's size choice; unset/unknown → medium (current default). */
export function logoSizeClass(size: LogoSize | null | undefined): string {
  return LOGO_SIZE_CLASSES[size as LogoSize] ?? LOGO_SIZE_CLASSES.medium
}
