import React from 'react'
import Link from 'next/link'
import type { PromoSectionBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaDimensions, mediaSrcSet } from '@/lib/image'
import { safeHref } from '@/lib/safe-href'
import {
  HEADING_3XL as HEADING_TYPE_LARGE,
  HEADING_XL as HEADING_TYPE_COMPACT,
  BODY_LG as BODY_TYPE_LARGE,
  BODY_BASE as BODY_TYPE_COMPACT,
  BODY_SM as BODY_TYPE_SM,
  MEDIA_STANDARD as MEDIA_VISUAL,
} from '@/blocks/shared/vocab-classes'

const RADIUS: React.CSSProperties = { borderRadius: 'var(--radius-button, 0.5rem)' }

type CtaLink = { label?: string | null; href?: string | null }

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only. See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals PromoSection's pre-existing literal default, so an unstyled
// PromoSection renders pixel-identical to before this system existed. The
// heading/body/media consts below are shared byte-for-byte across blocks —
// see src/blocks/shared/vocab-classes.ts. EYEBROW_TYPE_SM/_XS stay local
// (no other block shares their exact eyebrow fallback).
// ---------------------------------------------------------------------------

/** Eyebrow typography for overlay/split: text-sm, semibold, wide, uppercase. */
const EYEBROW_TYPE_SM =
  'text-[length:var(--bs-eyebrow-size,0.875rem)] font-[weight:var(--bs-eyebrow-weight,600)] ' +
  '[text-transform:var(--bs-eyebrow-transform,uppercase)] tracking-[var(--bs-eyebrow-tracking,0.025em)] ' +
  '[font-family:var(--bs-eyebrow-font,inherit)] [font-style:var(--bs-eyebrow-style,normal)]'

/** Eyebrow typography for bannerStrip: text-xs, semibold, wide, uppercase. */
const EYEBROW_TYPE_XS =
  'text-[length:var(--bs-eyebrow-size,0.75rem)] font-[weight:var(--bs-eyebrow-weight,600)] ' +
  '[text-transform:var(--bs-eyebrow-transform,uppercase)] tracking-[var(--bs-eyebrow-tracking,0.025em)] ' +
  '[font-family:var(--bs-eyebrow-font,inherit)] [font-style:var(--bs-eyebrow-style,normal)]'

/** CTA pair; per-variant colors are passed in so contrast holds on each background. */
function PromoCtas({
  primary,
  secondary,
  primaryStyle,
  secondaryStyle,
  className = '',
}: {
  primary: CtaLink
  secondary: CtaLink
  primaryStyle: React.CSSProperties
  secondaryStyle: React.CSSProperties
  className?: string
}) {
  if (!primary.label && !secondary.label) return null
  return (
    <div className={`mt-2 flex flex-wrap gap-3 ${className}`}>
      {primary.label && primary.href && (
        <Link href={primary.href} data-nb-part="cta" className="inline-block px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-90" style={{ ...RADIUS, ...primaryStyle }}>
          {primary.label}
        </Link>
      )}
      {secondary.label && secondary.href && (
        <Link href={secondary.href} data-nb-part="cta" className="inline-block border px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-90" style={{ ...RADIUS, ...secondaryStyle }}>
          {secondary.label}
        </Link>
      )}
    </div>
  )
}

/**
 * Promo Section block — server component.
 *
 * Three self-styling variants (splitImage, overlay, bannerStrip) from one set
 * of content fields. Uses only per-tenant theme CSS vars (--color-primary,
 * --color-accent, --color-surface, --color-text, --font-heading, --radius-*).
 */
export function PromoSectionComponent({ block }: { block: PromoSectionBlock; ctx: BlockContext }) {
  const { variant, eyebrow, heading, body, media, primaryCtaLabel, primaryCtaHref, secondaryCtaLabel, secondaryCtaHref } = block

  const mediaObj = media !== null && typeof media === 'object' ? (media as Media) : null
  const mediaUrl = mediaObj?.url ?? null
  const mediaAlt = mediaObj?.alt ?? heading ?? ''

  const primary: CtaLink = { label: primaryCtaLabel, href: safeHref(primaryCtaHref) }
  const secondary: CtaLink = { label: secondaryCtaLabel, href: safeHref(secondaryCtaHref) }

  const image = mediaUrl ? (
    <img
      src={mediaUrl}
      srcSet={mediaSrcSet(mediaObj)}
      sizes="(min-width: 768px) 50vw, 100vw"
      width={mediaDimensions(mediaObj)?.width}
      height={mediaDimensions(mediaObj)?.height}
      alt={mediaAlt}
      data-nb-part="media"
      className={`h-full w-full object-cover ${MEDIA_VISUAL}`}
      loading="lazy"
    />
  ) : (
    <div data-nb-part="media" className={`h-full w-full bg-[var(--color-surface,#f3f4f6)] ${MEDIA_VISUAL}`} />
  )

  // Full-bleed image with a scrim and centered copy overlaid.
  if (variant === 'overlay') {
    return (
      <section className="relative flex min-h-[360px] items-center overflow-hidden bg-[var(--color-surface,#111827)]">
        {mediaUrl && (
          <img
            src={mediaUrl}
            srcSet={mediaSrcSet(mediaObj)}
            sizes="(min-width: 768px) 50vw, 100vw"
            alt={mediaAlt}
            data-nb-part="media"
            className={`absolute inset-0 h-full w-full object-cover ${MEDIA_VISUAL}`}
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[var(--bs-section-width,42rem)] px-6 py-[var(--bs-section-pad,4rem)] text-center text-white sm:px-8">
          {eyebrow && <p data-nb-part="eyebrow" className={`${EYEBROW_TYPE_SM} text-white/70`}>{eyebrow}</p>}
          <h2 data-nb-part="heading" className={`mt-2 ${HEADING_TYPE_LARGE} text-white`}>{heading}</h2>
          {body && <p data-nb-part="body" className={`mt-4 ${BODY_TYPE_LARGE} leading-relaxed text-white/85`}>{body}</p>}
          <PromoCtas
            primary={primary}
            secondary={secondary}
            className="justify-center"
            primaryStyle={{ background: 'var(--color-accent, #2563eb)' }}
            secondaryStyle={{ borderColor: 'rgba(255,255,255,0.6)' }}
          />
        </div>
      </section>
    )
  }

  // Compact banner: copy left, CTAs right on the primary color band.
  if (variant === 'bannerStrip') {
    return (
      <section className="px-6 py-[var(--bs-section-pad,2rem)] text-white sm:px-8" style={{ background: 'var(--color-primary, #111827)' }}>
        <div className="mx-auto flex max-w-[var(--bs-section-width,72rem)] flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            {eyebrow && <p data-nb-part="eyebrow" className={`${EYEBROW_TYPE_XS} text-white/70`}>{eyebrow}</p>}
            <h2 data-nb-part="heading" className={`${HEADING_TYPE_COMPACT} text-white`}>{heading}</h2>
            {body && <p data-nb-part="body" className={`mt-1 ${BODY_TYPE_SM} text-white/80`}>{body}</p>}
          </div>
          <PromoCtas
            primary={primary}
            secondary={secondary}
            className="mt-0 shrink-0"
            primaryStyle={{ background: 'var(--color-accent, #2563eb)' }}
            secondaryStyle={{ borderColor: 'rgba(255,255,255,0.6)' }}
          />
        </div>
      </section>
    )
  }

  // Split image (default): image panel + copy panel on the primary color.
  return (
    <section className="grid min-h-[360px] grid-cols-1 md:grid-cols-2">
      <div className="relative order-1 min-h-[240px] bg-[var(--color-surface,#f9fafb)] md:min-h-0">{image}</div>
      <div className="order-2 flex flex-col justify-center gap-4 bg-[var(--color-primary,#111827)] px-8 py-[var(--bs-section-pad,3rem)] text-white sm:px-12 lg:px-16">
        {eyebrow && <p data-nb-part="eyebrow" className={`${EYEBROW_TYPE_SM} text-white/70`}>{eyebrow}</p>}
        <h2 data-nb-part="heading" className={`${HEADING_TYPE_LARGE} text-white`}>{heading}</h2>
        {body && <p data-nb-part="body" className={`max-w-lg ${BODY_TYPE_COMPACT} leading-relaxed text-white/80`}>{body}</p>}
        <PromoCtas
          primary={primary}
          secondary={secondary}
          primaryStyle={{ background: 'var(--color-accent, #2563eb)' }}
          secondaryStyle={{ borderColor: 'rgba(255,255,255,0.6)' }}
        />
      </div>
    </section>
  )
}
