import type { CSSProperties } from 'react'

/**
 * Section color schemes (Slice C of the theming roadmap).
 *
 * A page section renders in one of a few token-derived color schemes. The scheme
 * sets `--section-bg` / `--section-fg` / `--section-muted` / `--section-heading`
 * CSS vars (and, for non-default schemes, an actual background/color band) so a
 * block's own markup can stay scheme-agnostic — it just reads the section vars.
 *
 * The active scheme per block comes from BLOCK_DEFAULT_SCHEME today; in Slice E a
 * theme preset (and later a per-instance page-builder field) can override it.
 */
export type SectionScheme = 'default' | 'muted' | 'inverse' | 'accent'

// A contrast color at reduced emphasis, for muted text on inverse/accent bands.
const CONTRAST_MUTED = 'color-mix(in srgb, var(--color-primary-contrast) 72%, transparent)'

/** CSS custom properties (+ band background) for a section color scheme. */
export function sectionVars(scheme: SectionScheme): CSSProperties {
  switch (scheme) {
    case 'muted':
      return {
        '--section-bg': 'var(--color-surface-alt)',
        '--section-fg': 'var(--color-text)',
        '--section-muted': 'var(--color-text-muted)',
        '--section-heading': 'var(--color-heading)',
        background: 'var(--section-bg)',
        color: 'var(--section-fg)',
      } as CSSProperties
    case 'inverse':
      return {
        '--section-bg': 'var(--color-primary)',
        '--section-fg': 'var(--color-primary-contrast)',
        '--section-muted': CONTRAST_MUTED,
        '--section-heading': 'var(--color-primary-contrast)',
        background: 'var(--section-bg)',
        color: 'var(--section-fg)',
      } as CSSProperties
    case 'accent':
      return {
        '--section-bg': 'var(--color-accent)',
        '--section-fg': 'var(--color-primary-contrast)',
        '--section-muted': CONTRAST_MUTED,
        '--section-heading': 'var(--color-primary-contrast)',
        background: 'var(--section-bg)',
        color: 'var(--section-fg)',
      } as CSSProperties
    case 'default':
    default:
      // No background/color band — the section inherits the page background, so
      // stacking default sections reads as one continuous surface.
      return {
        '--section-bg': 'var(--color-bg)',
        '--section-fg': 'var(--color-text)',
        '--section-muted': 'var(--color-text-muted)',
        '--section-heading': 'var(--color-heading)',
      } as CSSProperties
  }
}

/**
 * Default color scheme per block type. Preserves each block's current look now
 * (Hero/Testimonials on a muted band, CTA on an inverse band); a theme preset
 * overrides this map in Slice E.
 */
export const BLOCK_DEFAULT_SCHEME: Record<string, SectionScheme> = {
  hero: 'muted',
  ctaBanner: 'inverse',
  testimonials: 'muted',
  // Trust badges, reviews and the ticker sit on a subtle band, like testimonials.
  incentives: 'muted',
  reviews: 'muted',
  ticker: 'muted',
  // mediaHero, promoSection, categoryPreviews and storyStats self-style
  // (media-heavy), so they stay on the default scheme to avoid a competing band.
}
