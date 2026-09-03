// ---------------------------------------------------------------------------
// Shared `--bs-*` block-style class-string vocabulary.
//
// These are the Tailwind arbitrary-value class strings that multiple storefront
// blocks (`src/blocks/*/Component.tsx`) declared as identical local consts
// after the block-style system landed (see src/blocks/Hero/Component.tsx for
// the full pattern writeup). Hoisted here once, byte-for-byte, to remove the
// duplication.
//
// Tailwind v4 scans every source file under the project automatically (no
// config file, `@import "tailwindcss"` in globals.css) — this module is
// scanned like any other, so these literal strings still compile. Do NOT
// build these via template-literal interpolation or any computed string:
// Tailwind's static scanner only sees literal string text, and a computed
// string silently fails to compile.
//
// Every var reference bakes in a fallback equal to the blocks' pre-existing
// literal default. That fallback is part of the const's identity — only
// blocks whose local const had the EXACT SAME fallback (and full string) may
// share a given export below. Do not repurpose one of these consts for a
// block whose fallback differs even slightly; add a new export instead.
// ---------------------------------------------------------------------------

/**
 * Heading typography — text-2xl -> sm:3xl, weight 700, tight tracking.
 * Shared by: Contact, FAQ, FeatureGrid, Incentives, NewsletterSignup,
 * Reviews, Steps, Testimonials, VideoEmbed (its "compact" heading profile).
 */
export const HEADING_2XL =
  'text-[length:var(--bs-heading-size,1.5rem)] sm:text-[length:var(--bs-heading-size,1.875rem)] ' +
  'font-[weight:var(--bs-heading-weight,700)] tracking-[var(--bs-heading-tracking,-0.025em)] ' +
  '[font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] ' +
  '[text-transform:var(--bs-heading-transform,none)]'

/**
 * Heading typography — text-xl -> sm:2xl, weight 700, tight tracking.
 * Shared by: LogoStrip, PromoSection (its "compact" heading profile).
 */
export const HEADING_XL =
  'text-[length:var(--bs-heading-size,1.25rem)] sm:text-[length:var(--bs-heading-size,1.5rem)] ' +
  'font-[weight:var(--bs-heading-weight,700)] tracking-[var(--bs-heading-tracking,-0.025em)] ' +
  '[font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] ' +
  '[text-transform:var(--bs-heading-transform,none)]'

/**
 * Heading typography — text-3xl -> sm:4xl, weight 800 (extrabold), tight tracking.
 * Shared by: PromoSection, VideoEmbed (each one's "large" heading profile).
 */
export const HEADING_3XL =
  'text-[length:var(--bs-heading-size,1.875rem)] sm:text-[length:var(--bs-heading-size,2.25rem)] ' +
  'font-[weight:var(--bs-heading-weight,800)] tracking-[var(--bs-heading-tracking,-0.025em)] ' +
  '[font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] ' +
  '[text-transform:var(--bs-heading-transform,none)]'

/**
 * Body/subheading typography — text-sm, weight 400, normal tracking.
 * Shared by: Contact (address body), PromoSection (its "sm" body profile),
 * VideoEmbed (caption body).
 */
export const BODY_SM =
  'text-[length:var(--bs-subheading-size,0.875rem)] font-[weight:var(--bs-subheading-weight,400)] ' +
  'tracking-[var(--bs-subheading-tracking,0em)] [font-family:var(--bs-subheading-font,inherit)] ' +
  '[font-style:var(--bs-subheading-style,normal)] [text-transform:var(--bs-subheading-transform,none)]'

/**
 * Body/subheading typography — text-base, weight 400, normal tracking.
 * Shared by: Hero (its "compact" subheading profile), PromoSection (its
 * "compact" body profile), StoryStats.
 */
export const BODY_BASE =
  'text-[length:var(--bs-subheading-size,1rem)] font-[weight:var(--bs-subheading-weight,400)] ' +
  'tracking-[var(--bs-subheading-tracking,0em)] [font-family:var(--bs-subheading-font,inherit)] ' +
  '[font-style:var(--bs-subheading-style,normal)] [text-transform:var(--bs-subheading-transform,none)]'

/**
 * Body/subheading typography — text-lg, weight 400, normal tracking.
 * Shared by: Hero (its "large" subheading profile), PromoSection (its
 * "large" body profile).
 */
export const BODY_LG =
  'text-[length:var(--bs-subheading-size,1.125rem)] font-[weight:var(--bs-subheading-weight,400)] ' +
  'tracking-[var(--bs-subheading-tracking,0em)] [font-family:var(--bs-subheading-font,inherit)] ' +
  '[font-style:var(--bs-subheading-style,normal)] [text-transform:var(--bs-subheading-transform,none)]'

/**
 * Media radius/shadow/blend, un-rounded default (radius fallback 0) — always
 * safe to consume regardless of variant.
 * Shared by: FeaturedProduct, Hero, PromoSection, StoryStats, VideoEmbed.
 * NOT shared with Contact's MEDIA_VISUAL, whose radius fallback is 0.25rem
 * (a different literal default) and stays local to Contact.
 */
export const MEDIA_STANDARD =
  'rounded-[var(--bs-media-radius,var(--bs-media-layout-radius,0))] ' +
  'shadow-[var(--bs-media-shadow,none)] [mix-blend-mode:var(--bs-media-blend,normal)]'
