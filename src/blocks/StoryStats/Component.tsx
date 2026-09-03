import React from 'react'
import type { StoryStatsBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaSrcSet } from '@/lib/image'
import { BODY_BASE as BODY_TYPE, MEDIA_STANDARD as MEDIA_VISUAL } from '@/blocks/shared/vocab-classes'

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the item-level
// stat parts, item-heading/item-body, are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals StoryStats's pre-existing literal default, so an unstyled
// StoryStats renders pixel-identical to before this system existed.
// BODY_TYPE (text-base, normal weight/tracking) and MEDIA_VISUAL (radius
// fallback 0, un-rounded) are shared byte-for-byte across blocks — see
// src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/** Eyebrow pill typography — text-[11px], semibold, wide, uppercase. */
const EYEBROW_TYPE =
  'text-[length:var(--bs-eyebrow-size,11px)] font-[weight:var(--bs-eyebrow-weight,600)] ' +
  '[text-transform:var(--bs-eyebrow-transform,uppercase)] tracking-[var(--bs-eyebrow-tracking,0.16em)] ' +
  '[font-family:var(--bs-eyebrow-font,inherit)] [font-style:var(--bs-eyebrow-style,normal)]'

/** Heading typography — text-3xl -> sm:4xl -> lg:5xl, semibold, tight. */
const HEADING_TYPE =
  'text-[length:var(--bs-heading-size,1.875rem)] sm:text-[length:var(--bs-heading-size,2.25rem)] ' +
  'lg:text-[length:var(--bs-heading-size,3rem)] leading-[1.1] ' +
  'font-[weight:var(--bs-heading-weight,600)] tracking-[var(--bs-heading-tracking,-0.025em)] ' +
  '[font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] ' +
  '[text-transform:var(--bs-heading-transform,none)]'

/**
 * StoryStats block — server component.
 *
 * A contained, rounded, shadowed "story" card: a photo alongside a dark text
 * panel with an eyebrow pill, serif heading, body, and a row of stat counters.
 * `variant` chooses which side the image sits on. Self-styling (the dark panel
 * comes from --color-text with light --color-bg text), so it reads well on any
 * theme; the eyebrow pill uses the brand --color-primary.
 */
export function StoryStatsComponent({ block }: { block: StoryStatsBlock; ctx: BlockContext }) {
  const { variant, eyebrow, heading, body, image, stats } = block

  const media = image !== null && typeof image === 'object' && 'url' in image ? (image as Media) : null
  const imageUrl = media?.url ?? null
  const imageAlt = media?.alt ?? heading ?? ''
  const imageRight = (variant ?? 'imageRight') === 'imageRight'
  const rows = (stats ?? []).filter((s) => s.value || s.label)

  const imageCol = (
    <div className={`relative min-h-[320px] bg-(--color-surface-alt) md:min-h-0 ${imageRight ? 'md:order-2' : 'md:order-1'}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          srcSet={mediaSrcSet(media)}
          sizes="100vw"
          alt={imageAlt}
          data-nb-part="media"
          className={`absolute inset-0 h-full w-full object-cover ${MEDIA_VISUAL}`}
          loading="lazy"
        />
      ) : null}
    </div>
  )

  const textCol = (
    <div
      className={`flex flex-col justify-center gap-5 px-8 py-14 sm:px-12 sm:py-16 lg:px-16 text-(--color-bg) ${imageRight ? 'md:order-1' : 'md:order-2'}`}
      style={{ background: 'var(--color-text)' }}
    >
      {eyebrow && (
        <span
          data-nb-part="eyebrow"
          className={`self-start ${EYEBROW_TYPE} text-(--color-primary-contrast)`}
          style={{
            background: 'var(--color-primary)',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-button)',
          }}
        >
          {eyebrow}
        </span>
      )}
      <h2 data-nb-part="heading" className={`${HEADING_TYPE} text-(--section-heading)`}>
        {heading}
      </h2>
      {body && <p data-nb-part="body" className={`max-w-md ${BODY_TYPE} leading-relaxed opacity-80`}>{body}</p>}
      {rows.length > 0 && (
        <dl
          className="mt-4 grid grid-cols-3 gap-6 border-t pt-6"
          style={{ borderColor: 'color-mix(in srgb, var(--color-bg) 22%, transparent)' }}
        >
          {rows.map((s) => (
            <div key={s.id} data-nb-part="item">
              <dt data-nb-part="item-heading" className="text-3xl font-semibold sm:text-4xl font-(family-name:--font-heading)">
                {s.value}
              </dt>
              <dd data-nb-part="item-body" className="mt-1 text-xs uppercase tracking-[0.15em] opacity-70">{s.label}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )

  return (
    <section className="px-4 py-[var(--bs-section-pad,4rem)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[var(--bs-section-width,72rem)] grid-cols-1 overflow-hidden rounded-(--radius-card) shadow-[0_16px_50px_rgba(60,55,40,0.12)] md:grid-cols-2">
        {imageCol}
        {textCol}
      </div>
    </section>
  )
}
