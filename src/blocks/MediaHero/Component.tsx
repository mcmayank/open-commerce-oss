import React from 'react'
import Link from 'next/link'
import type { MediaHeroBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaDimensions, mediaSrcSet } from '@/lib/image'
import { safeHref } from '@/lib/safe-href'

const MIN_H: Record<string, string> = {
  md: 'min-h-[440px]',
  lg: 'min-h-[600px]',
  screen: 'min-h-screen',
}
const SCRIM: Record<string, string> = {
  none: '',
  light: 'bg-black/25',
  medium: 'bg-black/45',
  dark: 'bg-black/65',
}
const V_ALIGN: Record<string, string> = { top: 'items-start', middle: 'items-center', bottom: 'items-end' }
const TEXT_ALIGN: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }
const SELF_ALIGN: Record<string, string> = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' }
const CTA_JUSTIFY: Record<string, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

function resolveMedia(m: MediaHeroBlock['media']): Media | null {
  return m !== null && typeof m === 'object' && 'url' in m ? (m as Media) : null
}

/** Image OR video (branched on mimeType) filling its container. */
function MediaLayer({ media, poster, className, sizes }: { media: Media | null; poster: string | null; className: string; sizes: string }) {
  const url = media?.url ?? null
  if (!url) return <div data-nb-part="media" className={`${className} bg-[var(--color-surface-alt,#f3f4f6)]`} />
  if (media?.mimeType?.startsWith('video/')) {
    return (
      <video data-nb-part="media" className={className} autoPlay muted loop playsInline poster={poster ?? undefined}>
        <source src={url} type={media.mimeType ?? undefined} />
      </video>
    )
  }
  const dim = mediaDimensions(media)
  return (
    <img
      src={url}
      srcSet={mediaSrcSet(media)}
      sizes={sizes}
      width={dim?.width}
      height={dim?.height}
      alt={media?.alt ?? ''}
      data-nb-part="media"
      className={className}
    />
  )
}

/**
 * MediaHero block — server component.
 *
 * Two layouts:
 *  - `split` (default): a contained card with the media in one column and a
 *    brand-color text panel (eyebrow / serif heading / body / two CTAs) in the
 *    other — the editorial hero.
 *  - `overlay`: a full-bleed media background with a scrim and overlaid text.
 * The single `media` upload is an image OR a muted-loop video (branched on
 * mimeType). Styling uses only per-tenant theme tokens.
 */
export function MediaHeroComponent({ block }: { block: MediaHeroBlock; ctx: BlockContext }) {
  const {
    variant, media, poster, eyebrow, heading, subheading,
    textAlign, verticalAlign, overlay, minHeight,
    primaryCtaLabel, primaryCtaHref, secondaryCtaLabel, secondaryCtaHref,
  } = block

  const mediaObj = resolveMedia(media)
  const posterUrl = resolveMedia(poster)?.url ?? null
  const primaryHref = safeHref(primaryCtaHref)
  const secondaryHref = safeHref(secondaryCtaHref)
  const hasCta = (primaryCtaLabel && primaryHref) || (secondaryCtaLabel && secondaryHref)

  // ── Split card (default) ──────────────────────────────────────────────────
  if ((variant ?? 'split') === 'split') {
    return (
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 overflow-hidden rounded-(--radius-card) shadow-[0_18px_55px_rgba(60,55,40,0.14)] md:grid-cols-2">
          <MediaLayer
            media={mediaObj}
            poster={posterUrl}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="relative min-h-[300px] h-full w-full object-cover md:min-h-[460px]"
          />
          <div
            className="flex flex-col justify-center gap-5 px-8 py-14 sm:px-12 sm:py-16 lg:px-16 text-(--color-primary-contrast)"
            style={{ background: 'var(--color-primary)' }}
          >
            {eyebrow && (
              <p data-nb-part="eyebrow" className="text-xs font-medium uppercase tracking-[0.35em] opacity-80">{eyebrow}</p>
            )}
            <h1 data-nb-part="heading" className="text-4xl font-normal leading-[1.03] tracking-tight text-(--section-heading) sm:text-5xl lg:text-6xl">
              {heading}
            </h1>
            {subheading && <p data-nb-part="body" className="max-w-md text-base leading-relaxed opacity-85">{subheading}</p>}
            {hasCta && (
              <div className="mt-2 flex flex-wrap gap-3">
                {primaryCtaLabel && primaryHref && (
                  <Link
                    href={primaryHref}
                    data-nb-part="cta"
                    className="inline-block px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-90 text-(--color-text)"
                    style={{ background: 'var(--color-primary-contrast)', borderRadius: 'var(--radius-button)' }}
                  >
                    {primaryCtaLabel}
                  </Link>
                )}
                {secondaryCtaLabel && secondaryHref && (
                  <Link
                    href={secondaryHref}
                    data-nb-part="cta"
                    className="inline-block border px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-90"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-primary-contrast) 55%, transparent)', borderRadius: 'var(--radius-button)' }}
                  >
                    {secondaryCtaLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  // ── Full-bleed overlay ────────────────────────────────────────────────────
  const align = (textAlign as string) ?? 'center'
  const minH = MIN_H[(minHeight as string) ?? 'lg'] ?? MIN_H.lg
  const scrim = SCRIM[(overlay as string) ?? 'medium'] ?? SCRIM.medium
  const vAlign = V_ALIGN[(verticalAlign as string) ?? 'middle'] ?? V_ALIGN.middle
  const alignText = TEXT_ALIGN[align] ?? TEXT_ALIGN.center
  const alignSelf = SELF_ALIGN[align] ?? SELF_ALIGN.center
  const ctaJustify = CTA_JUSTIFY[align] ?? CTA_JUSTIFY.center

  return (
    <section
      className={`relative flex ${minH} ${vAlign} overflow-hidden bg-[var(--color-surface-alt,#111827)]`}
    >
      <MediaLayer media={mediaObj} poster={posterUrl} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
      {scrim && <div className={`absolute inset-0 ${scrim}`} aria-hidden="true" />}
      <div className={`relative z-10 w-full max-w-2xl px-6 py-20 sm:px-8 ${alignSelf} ${alignText}`}>
        {eyebrow && <p data-nb-part="eyebrow" className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">{eyebrow}</p>}
        <h1 data-nb-part="heading" className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
          {heading}
        </h1>
        {subheading && <p data-nb-part="body" className="mt-5 text-lg leading-relaxed text-white/85">{subheading}</p>}
        {hasCta && (
          <div className={`mt-8 flex flex-wrap gap-3 ${ctaJustify}`}>
            {primaryCtaLabel && primaryHref && (
              <Link
                href={primaryHref}
                data-nb-part="cta"
                className="inline-block px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90 text-(--color-primary-contrast)"
                style={{ background: 'var(--color-accent, #2563eb)', borderRadius: 'var(--radius-button, 0.5rem)' }}
              >
                {primaryCtaLabel}
              </Link>
            )}
            {secondaryCtaLabel && secondaryHref && (
              <Link
                href={secondaryHref}
                data-nb-part="cta"
                className="inline-block border border-white/70 px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
              >
                {secondaryCtaLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
