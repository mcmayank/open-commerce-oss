import React from 'react'
import Link from 'next/link'
import type { HeroBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { safeHref } from '@/lib/safe-href'
import { HeroMedia } from './HeroMedia'
import { HeroCtas } from './HeroCtas'
import { FloatingCards } from './FloatingCards'
import {
  BODY_BASE as SUBHEADING_TYPE_COMPACT,
  BODY_LG as SUBHEADING_TYPE_LARGE,
  MEDIA_STANDARD as MEDIA_VISUAL,
} from '@/blocks/shared/vocab-classes'

const OVERLAY_SCRIM: Record<string, string> = {
  none: '', light: 'bg-black/25', medium: 'bg-black/45', dark: 'bg-black/65',
}
/**
 * Explicit hero heights. Every value is a LITERAL class string so Tailwind's
 * static scanner sees it (same rule as the --bs-* classes below).
 */
const MIN_H: Record<string, string> = {
  md: 'min-h-[380px]',
  lg: 'min-h-[480px]',
  half: 'min-h-[50vh]',
  threeQuarter: 'min-h-[75vh]',
  screen: 'min-h-screen',
}

/**
 * What `auto` means per variant: the height that branch rendered before the
 * control existed. Keeping these as the fallback is what lets the migration
 * rewrite every stored 'lg' to 'auto' without moving a single live storefront.
 */
const MIN_H_FALLBACK = {
  splitGrid: 'min-h-[420px]',
  overlay: 'min-h-[480px]',
  stacked: '',
  centered: 'min-h-[420px]',
} as const

/**
 * Resolve a hero's height class. An explicit choice REPLACES the variant's
 * natural height rather than joining it — two `min-h-*` classes on one element
 * collide on specificity and the winner would depend on stylesheet order.
 */
function heightClass(minHeight: string | null | undefined, fallback: string): string {
  const key = minHeight ?? 'auto'
  if (key === 'auto') return fallback
  return MIN_H[key] ?? fallback
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — see docs/superpowers/specs/
// 2026-08-17-block-style-system-design.md §2c/§3 and src/lib/block-style/
// vocabulary.ts.
//
// Every class below is a *literal* string (never built with template-literal
// interpolation) so Tailwind's static scanner can see the full class text
// and compile it — the resolver only ever changes the runtime *value* of the
// `--bs-*` var an ancestor sets (RenderBlocks), never the class itself.
//
// Every var reference embeds a fallback equal to Hero's PRE-EXISTING literal
// default (`var(--bs-x, <current-default>)`), so a hero with no style
// override renders pixel-identical to before this system existed. Where the
// old markup paired a Tailwind size utility with its own implicit
// line-height (e.g. `text-3xl`), an explicit literal `leading-*` class
// reproduces that pairing — line-height itself is out of the v1 vocabulary
// (design doc §10.3, a deferred fast-follow), so it is never var-driven.
//
// Font-family and the accent's colour flow via a class reading a `--bs-*`
// var, never inline (`inline-style.test.tsx`); heading colour keeps reading
// `--section-heading` exactly where it does today, including the
// dark-scrim/dark-surface exception (`heading-color.test.tsx`) — the
// vocabulary does not touch heading/eyebrow/subheading colour at all.
// ---------------------------------------------------------------------------

/** Eyebrow typography — identical literal default across every Hero variant (text-sm/600/wide/uppercase). */
const EYEBROW_TYPE =
  'text-[length:var(--bs-eyebrow-size,0.875rem)] leading-[1.25rem] ' +
  'font-[weight:var(--bs-eyebrow-weight,600)] tracking-[var(--bs-eyebrow-tracking,0.025em)] ' +
  '[font-family:var(--bs-eyebrow-font,inherit)] [font-style:var(--bs-eyebrow-style,normal)] ' +
  // The generic per-element uppercase toggle wins if a merchant sets it explicitly; else the
  // eyebrow.treatment bundle's implied transform wins; else today's hard-coded default (uppercase).
  '[text-transform:var(--bs-eyebrow-transform,var(--bs-eyebrow-treatment-transform,uppercase))]'

/**
 * The eyebrow.treatment structural bundle (pill / plain-caps / plain — see
 * vocabulary.ts `MultiVocabControl`). Deliberately carries NO colour: colour
 * stays governed by whatever `text-(--color-...)` class the variant already
 * applies (§8, "text colour is not in the vocabulary"). Fallbacks are all
 * "no chrome" (transparent/0/0), matching today's plain eyebrow exactly.
 */
const EYEBROW_TREATMENT =
  'inline-block w-fit bg-[var(--bs-eyebrow-treatment-bg,transparent)] ' +
  'p-[var(--bs-eyebrow-treatment-pad,0)] rounded-[var(--bs-eyebrow-treatment-radius,0)]'

/** Heading typography for the "compact" profile (split/showcase/stacked): 3xl -> sm:4xl, extrabold, tight. */
const HEADING_TYPE_COMPACT =
  'text-[length:var(--bs-heading-size,1.875rem)] sm:text-[length:var(--bs-heading-size,2.25rem)] ' +
  'leading-[2.25rem] sm:leading-[2.5rem] ' +
  'font-[weight:var(--bs-heading-weight,800)] tracking-[var(--bs-heading-tracking,-0.025em)] ' +
  '[font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] ' +
  '[text-transform:var(--bs-heading-transform,none)]'

/** Heading typography for the "large" profile (centered/overlay/video): 4xl -> sm:5xl, extrabold, tight. */
const HEADING_TYPE_LARGE =
  'text-[length:var(--bs-heading-size,2.25rem)] sm:text-[length:var(--bs-heading-size,3rem)] ' +
  'leading-[2.5rem] sm:leading-none ' +
  'font-[weight:var(--bs-heading-weight,800)] tracking-[var(--bs-heading-tracking,-0.025em)] ' +
  '[font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] ' +
  '[text-transform:var(--bs-heading-transform,none)]'

// SUBHEADING_TYPE_COMPACT (base, normal weight/tracking, "compact" profile)
// and SUBHEADING_TYPE_LARGE (lg, normal weight/tracking, "large" profile) are
// shared byte-for-byte across blocks — see src/blocks/shared/vocab-classes.ts
// (imported above as BODY_BASE / BODY_LG).

/**
 * The two-tone accent span (Showcase's `headingAccent`). Colour is the ONE
 * text-colour control the vocabulary permits (§3: "token-governed, no
 * hex") — the fallback is `var(--color-accent)`, matching today's baked-in
 * two-tone look exactly, not the enum's own "inherit" option value.
 */
const ACCENT_TYPE =
  'block [font-family:var(--bs-accent-font,inherit)] ' +
  'text-[color:var(--bs-accent-color,var(--color-accent))] ' +
  '[font-style:var(--bs-accent-style,normal)]'

// MEDIA_VISUAL (radius fallback 0, un-rounded) is shared byte-for-byte
// across blocks — see src/blocks/shared/vocab-classes.ts (imported above as
// MEDIA_STANDARD). `media.radius` wins over the `media.layout` bundle's
// implied radius, which wins over 0 (today's default, un-rounded full-bleed
// media).

/** media.layout structural bundle, applied to the media's wrapper box (not the media element itself). */
const MEDIA_LAYOUT_PAD = 'p-[var(--bs-media-layout-pad,0)]'

/**
 * Shared page container width. Every other block centres its content on
 * `max-w-[var(--bs-section-width,72rem)]` (ProductGrid, CategoryPreviews) or
 * its literal ancestor `max-w-6xl` (Testimonials, Steps, FeatureGrid, Reviews),
 * so Hero uses the same default — 72rem is also the vocabulary's `normal`
 * (vocabulary.ts SECTION_WIDTH_CSS: narrow 48rem / normal 72rem / wide 88rem).
 * Hero's previous 42rem default was not on that scale at all, which meant
 * picking "Narrow" in the inspector made a hero *wider* than leaving it unset.
 */
const SECTION_WIDTH = 'max-w-[var(--bs-section-width,72rem)]'

/**
 * Hero block — server component. Fully theme-token driven: colors, heading font,
 * and radius come from the active theme's CSS vars (see src/lib/theme-tokens.ts).
 * Also consumes the block-style system's `--bs-*` vars (see block comment above).
 *
 * Unified block superseding SplitHero and MediaHero: one `variant` picker drives
 * six layouts from shared content fields. `centered` reproduces the
 * pre-unification Hero output exactly (legacy backgroundImage + single
 * ctaLabel/ctaHref), because Postgres backfilled `variant='centered'` on every
 * existing hero row.
 */
export function HeroComponent({ block }: { block: HeroBlock; ctx: BlockContext }) {
  const v = block.variant ?? 'centered'
  const mediaObj = block.media && typeof block.media === 'object' ? (block.media as Media) : null
  const posterUrl = block.poster && typeof block.poster === 'object' ? (block.poster as Media).url ?? null : null
  const primary = { label: block.primaryCtaLabel, href: safeHref(block.primaryCtaHref) }
  const secondary = { label: block.secondaryCtaLabel, href: safeHref(block.secondaryCtaHref) }

  switch (v) {
    case 'split':
    case 'showcase': {
      const right = (block.mediaSide ?? 'right') === 'right'
      return (
        <section>
          {/* The container wraps the whole grid, not just the copy, so the MEDIA half ends on
              the same line as every other block's content rather than bleeding to the viewport
              edge. Both halves are inside it, so no per-column width maths is needed. */}
          <div className={`mx-auto grid ${heightClass(block.minHeight, MIN_H_FALLBACK.splitGrid)} ${SECTION_WIDTH} grid-cols-1 md:grid-cols-2`}>
            <div className={`relative order-1 min-h-[260px] bg-(--color-surface) md:min-h-0 ${MEDIA_LAYOUT_PAD} ${right ? 'md:order-2' : 'md:order-1'}`}>
              <HeroMedia media={mediaObj} poster={posterUrl} sizes="(min-width:1152px) 36rem, (min-width:768px) 50vw, 100vw"
                alt={mediaObj?.alt ?? block.heading ?? ''} className={`h-full w-full object-cover ${MEDIA_VISUAL}`} />
              {v === 'showcase' && <FloatingCards cards={block.floatingCards as any} />}
            </div>
            <div className={`order-2 flex flex-col justify-center gap-4 px-8 py-[var(--bs-section-pad,3rem)] sm:px-12 lg:px-16 ${right ? 'md:order-1' : 'md:order-2'}`}>
              {block.eyebrow && (
                <p data-nb-part="eyebrow" className={`${EYEBROW_TYPE} ${EYEBROW_TREATMENT} text-(--color-accent)`}>{block.eyebrow}</p>
              )}
              <h1 data-nb-part="heading" className={`${HEADING_TYPE_COMPACT} text-(--section-heading)`}>
                {block.heading}
                {v === 'showcase' && block.headingAccent && <span className={ACCENT_TYPE}>{block.headingAccent}</span>}
              </h1>
              {block.subheading && <p data-nb-part="body" className={`max-w-lg ${SUBHEADING_TYPE_COMPACT} leading-relaxed text-(--section-muted)`}>{block.subheading}</p>}
              {v === 'showcase' && block.featureChip && (
                <span className="inline-block w-fit rounded-(--radius-button) border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium text-(--section-fg)">{block.featureChip}</span>
              )}
              <HeroCtas primary={primary} secondary={secondary}
                primaryStyle={{ background: 'var(--color-accent)' }} primaryClassName="text-(--color-primary-contrast)"
                secondaryStyle={{ borderColor: 'var(--color-border)' }} />
            </div>
          </div>
        </section>
      )
    }
    case 'overlay':
    case 'video': {
      const vAlign = { top: 'items-start', middle: 'items-center', bottom: 'items-end' }[block.verticalAlign ?? 'middle']
      const align = block.textAlign ?? 'center'
      const alignText = { left: 'text-left', center: 'text-center', right: 'text-right' }[align]
      const alignSelf = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' }[align]
      return (
        <section className={`relative flex overflow-hidden bg-(--color-surface) ${heightClass(block.minHeight, MIN_H_FALLBACK.overlay)} ${vAlign}`}>
          <HeroMedia media={mediaObj} poster={posterUrl} sizes="100vw" alt={mediaObj?.alt ?? block.heading ?? ''}
            className={`absolute inset-0 h-full w-full object-cover ${MEDIA_VISUAL}`} />
          {(block.overlay ?? 'medium') !== 'none' && <div className={`absolute inset-0 ${OVERLAY_SCRIM[block.overlay ?? 'medium']}`} aria-hidden="true" />}
          <div className={`relative z-10 ${alignSelf} ${SECTION_WIDTH} px-6 py-[var(--bs-section-pad,5rem)] text-white ${alignText} sm:px-8`}>
            {block.eyebrow && <p data-nb-part="eyebrow" className={`${EYEBROW_TYPE} ${EYEBROW_TREATMENT} text-white/70`}>{block.eyebrow}</p>}
            <h1 data-nb-part="heading" className={`mt-2 ${HEADING_TYPE_LARGE} text-white`}>{block.heading}</h1>
            {block.subheading && <p data-nb-part="body" className={`mt-4 ${SUBHEADING_TYPE_LARGE} leading-relaxed text-white/85`}>{block.subheading}</p>}
            <HeroCtas primary={primary} secondary={secondary} className={{ left: 'justify-start', center: 'justify-center', right: 'justify-end' }[align]}
              primaryStyle={{ background: 'var(--color-accent)' }} secondaryStyle={{ borderColor: 'rgba(255,255,255,0.6)' }} secondaryClassName="text-white" />
          </div>
        </section>
      )
    }
    case 'stacked': {
      const align = block.textAlign ?? 'center'
      const alignText = { left: 'text-left', center: 'text-center', right: 'text-right' }[align]
      const alignSelf = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' }[align]
      return (
        <section className={`flex flex-col bg-(--color-surface) ${heightClass(block.minHeight, MIN_H_FALLBACK.stacked)}`}>
          <div className={`h-56 w-full bg-(--color-surface) sm:h-72 lg:h-96 ${MEDIA_LAYOUT_PAD}`}>
            <HeroMedia media={mediaObj} poster={posterUrl} sizes="100vw" alt={mediaObj?.alt ?? block.heading ?? ''} className={`h-full w-full object-cover ${MEDIA_VISUAL}`} />
          </div>
          <div className={`${alignSelf} flex ${SECTION_WIDTH} flex-col gap-4 px-6 py-[var(--bs-section-pad,3rem)] ${alignText} sm:px-8`}>
            {/* EYEBROW_TREATMENT's inline-block/w-fit opts this item out of the flex column's
                default cross-axis stretch, so it must be positioned explicitly via the same
                alignSelf value that governs textAlign everywhere else in this variant —
                otherwise it pins to flex-start (left) regardless of textAlign, even unstyled. */}
            {block.eyebrow && <p data-nb-part="eyebrow" className={`${EYEBROW_TYPE} ${EYEBROW_TREATMENT} ${alignSelf} text-(--color-accent)`}>{block.eyebrow}</p>}
            <h1 data-nb-part="heading" className={`${HEADING_TYPE_COMPACT} text-(--section-heading)`}>{block.heading}</h1>
            {block.subheading && <p data-nb-part="body" className={`max-w-lg ${SUBHEADING_TYPE_COMPACT} leading-relaxed text-(--section-muted)`}>{block.subheading}</p>}
            <HeroCtas primary={primary} secondary={secondary} primaryStyle={{ background: 'var(--color-primary)' }} primaryClassName="text-(--color-primary-contrast)" secondaryStyle={{ borderColor: 'var(--color-primary)' }} />
          </div>
        </section>
      )
    }
    case 'centered':
    default: {
      // Reproduces the pre-unification Hero. Legacy backgroundImage/ctaLabel/ctaHref,
      // falling back to media/primaryCta so a centered hero authored with the new
      // fields also works. Media (radius/shadow/layout/blend) is NOT wired here:
      // the background is a CSS `backgroundImage` on the section, not a
      // discrete media element, and restructuring that to gain style-vocabulary
      // support risks the pixel-identical guarantee this legacy path exists to
      // protect (see docblock above and the task-8 report).
      const bg = block.backgroundImage && typeof block.backgroundImage === 'object' && 'url' in block.backgroundImage
        ? (block.backgroundImage as Media).url : mediaObj?.url ?? null
      const cta = { label: block.ctaLabel ?? block.primaryCtaLabel, href: safeHref(block.ctaHref ?? block.primaryCtaHref) }
      const align = block.textAlign ?? 'center'
      const alignText = { left: 'text-left', center: 'text-center', right: 'text-right' }[align]
      const alignJustify = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }[align]
      return (
        <section className={`relative flex ${heightClass(block.minHeight, MIN_H_FALLBACK.centered)} items-center justify-center overflow-hidden py-[var(--bs-section-pad,5rem)]`}
          style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          {bg && <div className="absolute inset-0 bg-black/40" aria-hidden="true" />}
          <div className={`relative z-10 mx-auto ${SECTION_WIDTH} px-6 ${alignText}`}>
            {block.eyebrow && <p data-nb-part="eyebrow" className={`mb-3 ${EYEBROW_TYPE} ${EYEBROW_TREATMENT} ${bg ? 'text-white/80' : 'text-(--color-accent)'}`}>{block.eyebrow}</p>}
            <h1 data-nb-part="heading" className={`${HEADING_TYPE_LARGE} ${bg ? 'text-white' : 'text-(--section-heading)'}`}>{block.heading}</h1>
            {block.subheading && <p data-nb-part="body" className={`mt-4 ${SUBHEADING_TYPE_LARGE} leading-relaxed ${bg ? 'text-gray-100' : 'text-(--section-muted)'}`}>{block.subheading}</p>}
            {cta.label && cta.href && (
              <div className={`mt-8 flex ${alignJustify}`}>
                <Link href={cta.href} data-nb-part="cta" className="inline-block rounded-(--radius-button) bg-(--color-primary) px-8 py-3 text-sm font-semibold text-(--color-primary-contrast) transition-opacity hover:opacity-90">{cta.label}</Link>
              </div>
            )}
          </div>
        </section>
      )
    }
  }
}
