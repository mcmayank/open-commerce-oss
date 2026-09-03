import React from 'react'
import Link from 'next/link'
import type { SplitHeroBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaDimensions, mediaSrcSet } from '@/lib/image'
import { safeHref } from '@/lib/safe-href'

interface SplitHeroComponentProps {
  block: SplitHeroBlock
  ctx: BlockContext
}

const RADIUS_STYLE: React.CSSProperties = { borderRadius: 'var(--radius-button, 0.5rem)' }

type CtaLink = { label?: string | null; href?: string | null }

/** CTA pair; colors are passed in per-variant so contrast holds against each
 *  background. Module-level so it isn't re-created on every render. */
function SplitHeroCtas({
  primary,
  secondary,
  primaryStyle,
  secondaryStyle,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
}: {
  primary: CtaLink
  secondary: CtaLink
  primaryStyle: React.CSSProperties
  secondaryStyle: React.CSSProperties
  className?: string
  /** Extra classes for the primary/secondary link — used to carry an explicit
   *  text color that isn't already the ambient color of its surroundings. */
  primaryClassName?: string
  secondaryClassName?: string
}) {
  if (!primary.label && !secondary.label) return null
  return (
    <div className={`mt-2 flex flex-wrap gap-3 ${className}`}>
      {primary.label && primary.href && (
        <Link
          href={primary.href}
          data-nb-part="cta"
          className={`inline-block px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${primaryClassName}`}
          style={{ ...RADIUS_STYLE, ...primaryStyle }}
        >
          {primary.label}
        </Link>
      )}
      {secondary.label && secondary.href && (
        <Link
          href={secondary.href}
          data-nb-part="cta"
          className={`inline-block border px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${secondaryClassName}`}
          style={{ ...RADIUS_STYLE, ...secondaryStyle }}
        >
          {secondary.label}
        </Link>
      )}
    </div>
  )
}

/**
 * Split Hero block (Pro) — server component.
 *
 * Renders one of four layout variants (mediaLeft, mediaRight, overlay,
 * stacked) from the same content fields. Styling uses only the per-store
 * theme CSS vars set by <StoreTheme> (--color-primary, --color-accent,
 * --color-surface, --color-text, --font-body, --font-heading, --radius-button)
 * plus configurable content — no hardcoded brand colors, fonts, or copy.
 */
export function SplitHeroComponent({ block }: SplitHeroComponentProps) {
  const {
    variant,
    textAlign,
    overlayVerticalAlign,
    eyebrow,
    heading,
    subheading,
    media,
    primaryCtaLabel,
    primaryCtaHref,
    secondaryCtaLabel,
    secondaryCtaHref,
  } = block

  // Text-alignment classes for the centered layouts (overlay + stacked). Full
  // class names are used so Tailwind keeps them; alignSelf positions a max-width
  // text block; ctaJustify aligns the button row.
  const align = (textAlign as 'left' | 'center' | 'right' | null) ?? 'center'
  const TEXT_ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const
  const SELF_ALIGN = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' } as const
  const ITEMS_ALIGN = { left: 'items-start', center: 'items-center', right: 'items-end' } as const
  const CTA_JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const
  const alignText = TEXT_ALIGN[align]
  const alignSelf = SELF_ALIGN[align]
  const alignItems = ITEMS_ALIGN[align]
  const ctaJustify = CTA_JUSTIFY[align]

  // Vertical position of the overlay text over the image.
  const vAlign = (overlayVerticalAlign as 'top' | 'middle' | 'bottom' | null) ?? 'middle'
  const V_ALIGN = { top: 'items-start', middle: 'items-center', bottom: 'items-end' } as const
  const overlayItems = V_ALIGN[vAlign]

  const mediaObj = media !== null && typeof media === 'object' ? (media as Media) : null
  const mediaUrl = mediaObj?.url ?? null
  const mediaAlt = mediaObj?.alt ?? heading ?? ''

  const image = mediaUrl ? (
    <img
      src={mediaUrl}
      srcSet={mediaSrcSet(mediaObj)}
      sizes="(min-width: 768px) 50vw, 100vw"
      width={mediaDimensions(mediaObj)?.width}
      height={mediaDimensions(mediaObj)?.height}
      alt={mediaAlt}
      data-nb-part="media"
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : null

  const primaryCta: CtaLink = { label: primaryCtaLabel, href: safeHref(primaryCtaHref) }
  const secondaryCta: CtaLink = { label: secondaryCtaLabel, href: safeHref(secondaryCtaHref) }

  switch (variant) {
    // Asymmetric 2-col grid: image panel + text panel on --color-primary.
    case 'mediaRight':
    case 'mediaLeft': {
      const isRight = variant === 'mediaRight'
      return (
        <section className="grid min-h-[420px] grid-cols-1 md:grid-cols-2">
          <div
            className={`relative order-1 min-h-[260px] bg-[var(--color-surface,#f9fafb)] md:min-h-0 ${
              isRight ? 'md:order-2' : 'md:order-1'
            }`}
          >
            {image}
          </div>
          <div
            className={`order-2 flex flex-col justify-center gap-4 bg-[var(--color-primary,#111827)] px-8 py-12 text-white sm:px-12 lg:px-16 ${
              isRight ? 'md:order-1' : 'md:order-2'
            }`}
          >
            {eyebrow && <p data-nb-part="eyebrow" className="text-sm font-semibold uppercase tracking-wide text-white/70">{eyebrow}</p>}
            <h1 data-nb-part="heading" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {heading}
            </h1>
            {subheading && <p data-nb-part="body" className="max-w-lg text-base leading-relaxed text-white/80">{subheading}</p>}
            <SplitHeroCtas
              primary={primaryCta}
              secondary={secondaryCta}
              primaryStyle={{ background: 'var(--color-accent, #2563eb)' }}
              secondaryStyle={{ borderColor: 'rgba(255,255,255,0.6)' }}
            />
          </div>
        </section>
      )
    }

    // Full-bleed background image with a scrim + centered text overlaid on top.
    case 'overlay': {
      return (
        <section
          className={`relative flex min-h-[480px] overflow-hidden bg-[var(--color-surface,#111827)] ${overlayItems}`}
        >
          {mediaUrl && (
            <img
            src={mediaUrl}
            srcSet={mediaSrcSet(mediaObj)}
            sizes="(min-width: 768px) 50vw, 100vw"
            alt={mediaAlt}
            data-nb-part="media"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          )}
          <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
          <div className={`relative z-10 ${alignSelf} max-w-2xl px-6 py-20 text-white ${alignText} sm:px-8`}>
            {eyebrow && <p data-nb-part="eyebrow" className="text-sm font-semibold uppercase tracking-wide text-white/70">{eyebrow}</p>}
            <h1 data-nb-part="heading" className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              {heading}
            </h1>
            {subheading && <p data-nb-part="body" className="mt-4 text-lg leading-relaxed text-white/85">{subheading}</p>}
            <SplitHeroCtas
              primary={primaryCta}
              secondary={secondaryCta}
              className={ctaJustify}
              primaryStyle={{ background: 'var(--color-accent, #2563eb)' }}
              secondaryStyle={{ borderColor: 'rgba(255,255,255,0.6)' }}
            />
          </div>
        </section>
      )
    }

    // Image on top, centered text block below on the plain surface color.
    case 'stacked':
    default: {
      return (
        <section className="flex flex-col bg-[var(--color-surface,#ffffff)]">
          <div className="h-56 w-full sm:h-72 lg:h-96">{image}</div>
          <div
            className={`${alignSelf} flex max-w-2xl flex-col ${alignItems} gap-4 px-6 py-12 ${alignText} text-[var(--color-text,#111827)] sm:px-8`}
          >
            {eyebrow && (
              <p data-nb-part="eyebrow" className="text-sm font-semibold uppercase tracking-wide text-[var(--color-accent,#2563eb)]">
                {eyebrow}
              </p>
            )}
            <h1 data-nb-part="heading" className="text-3xl font-extrabold tracking-tight text-(--section-heading) sm:text-4xl">
              {heading}
            </h1>
            {subheading && <p data-nb-part="body" className="max-w-lg text-base leading-relaxed opacity-80">{subheading}</p>}
            <SplitHeroCtas
              primary={primaryCta}
              secondary={secondaryCta}
              className={ctaJustify}
              primaryClassName="text-white"
              primaryStyle={{ background: 'var(--color-primary, #111827)' }}
              secondaryStyle={{ borderColor: 'var(--color-primary, #111827)' }}
            />
          </div>
        </section>
      )
    }
  }
}
