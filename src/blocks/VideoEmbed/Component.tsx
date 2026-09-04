import React from 'react'
import type { VideoEmbedBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaSrcSet } from '@/lib/image'
import { normalizeEmbedUrl } from '@/blocks/lib/video-embed'
import { safeHref } from '@/lib/safe-href'
import {
  HEADING_2XL as HEADING_TYPE_COMPACT,
  HEADING_3XL as HEADING_TYPE_LARGE,
  BODY_SM as BODY_TYPE,
  MEDIA_STANDARD as MEDIA_VISUAL,
} from '@/blocks/shared/vocab-classes'

interface VideoEmbedComponentProps {
  block: VideoEmbedBlock
  ctx: BlockContext
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only. See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals VideoEmbed's pre-existing literal default, so an unstyled
// VideoEmbed renders pixel-identical to before this system existed. All four
// consts below (heading compact/large, caption body, media visual) are
// shared byte-for-byte across blocks — see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/**
 * Video Embed block — server component.
 *
 * Renders one of four layout variants (contained, fullBleed, sideBySide,
 * textOverlay) around a single video source: a normalized YouTube/Vimeo
 * embed URL, or an uploaded file. Styling uses only the per-store theme CSS
 * vars set by <StoreTheme> (--color-primary, --color-accent, --color-surface,
 * --color-text, --font-body, --font-heading, --radius-button) with fallbacks
 * — no hardcoded brand colors.
 */
export function VideoEmbedComponent({ block }: VideoEmbedComponentProps) {
  const { variant, heading, provider, url, poster, caption } = block

  const src = normalizeEmbedUrl(provider, url)

  const posterObj = poster !== null && typeof poster === 'object' ? (poster as Media) : null
  const posterUrl = posterObj?.url ?? null
  const posterAlt = posterObj?.alt ?? heading ?? ''

  const radiusStyle: React.CSSProperties = { borderRadius: 'var(--radius-button, 0.5rem)' }

  /**
   * The video surface: an embed <iframe>, or the poster <img> as a fallback.
   *
   * Self-hosted video was removed — no transcoding, no adaptive bitrate, no poster
   * generation, and the fastest way for one tenant to exhaust a storage tier. A
   * block that used it falls through to the poster rather than showing a broken
   * player, which is what the migration relies on.
   */
  function Player({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
    if (src) {
      return (
        <iframe
          src={src}
          title={heading ?? 'Embedded video'}
          data-nb-part="media"
          className={`absolute inset-0 h-full w-full ${MEDIA_VISUAL} ${className}`}
          style={style}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )
    }
    return posterUrl ? <PosterImage className={className} style={style} /> : null
  }

  function PosterImage({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
    if (!posterUrl) return null
    return (
      <img
        src={posterUrl}
        srcSet={mediaSrcSet(posterObj)}
        sizes="100vw"
        alt={posterAlt}
        data-nb-part="media"
        className={`absolute inset-0 h-full w-full object-cover ${MEDIA_VISUAL} ${className}`}
        style={style}
        loading="lazy"
      />
    )
  }

  const Caption = caption ? (
    <p data-nb-part="body" className={`mt-3 ${BODY_TYPE} opacity-70`}>{caption}</p>
  ) : null

  switch (variant) {
    // Video + caption/heading beside it in a two-column grid.
    case 'sideBySide': {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[var(--bs-section-width,64rem)] gap-8 md:grid-cols-2 md:items-center">
            <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-surface,#f9fafb)]" style={radiusStyle}>
              <Player />
            </div>
            <div>
              {heading && (
                <h2 data-nb-part="heading" className={`${HEADING_TYPE_COMPACT} text-(--section-heading)`}>
                  {heading}
                </h2>
              )}
              {Caption}
            </div>
          </div>
        </section>
      )
    }

    // Poster image with heading overlaid and a play affordance linking to the video.
    case 'textOverlay': {
      // Was `src ?? fileUrl`; self-hosted video is gone, so the embed URL is the
      // only destination. With neither, the poster renders as a plain image.
      // `src` is already scheme-safe by construction (normalizeEmbedUrl only ever
      // returns a hardcoded `https://` literal or null), but it is still routed
      // through safeHref so this anchor's safety doesn't rely on that invariant
      // holding forever.
      const playHref = safeHref(src) ?? undefined
      return (
        <section className="relative overflow-hidden bg-[var(--color-surface,#111827)]">
          <a
            href={playHref}
            target={playHref ? '_blank' : undefined}
            rel={playHref ? 'noopener noreferrer' : undefined}
            data-nb-part="cta"
            className="group relative flex min-h-[360px] w-full items-center justify-center overflow-hidden"
            aria-label={heading ?? 'Play video'}
          >
            <PosterImage />
            <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
            <div className="relative z-10 mx-auto flex max-w-[var(--bs-section-width,42rem)] flex-col items-center gap-4 px-6 py-[var(--bs-section-pad,4rem)] text-center sm:px-8">
              {heading && (
                <h2 data-nb-part="heading" className={`${HEADING_TYPE_LARGE} text-white`}>
                  {heading}
                </h2>
              )}
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                style={{ background: 'var(--color-accent, #2563eb)' }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </div>
          </a>
          {Caption && <div className="px-6 py-3 text-center sm:px-8">{Caption}</div>}
        </section>
      )
    }

    // Full-width video, no side padding, edge to edge.
    case 'fullBleed': {
      return (
        <section>
          <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-surface,#f9fafb)]">
            {heading && (
              <h2 data-nb-part="heading" className={`sr-only ${HEADING_TYPE_COMPACT} text-(--section-heading)`}>
                {heading}
              </h2>
            )}
            <Player />
          </div>
          {Caption && <div className="px-6 py-3 text-center sm:px-8">{Caption}</div>}
        </section>
      )
    }

    // Centered video panel with a heading above it. Default variant.
    case 'contained':
    default: {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[var(--bs-section-width,56rem)]">
            {heading && (
              <h2 data-nb-part="heading" className={`mb-6 text-center ${HEADING_TYPE_COMPACT} text-(--section-heading)`}>
                {heading}
              </h2>
            )}
            <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-surface,#f9fafb)]" style={radiusStyle}>
              <Player />
            </div>
            {Caption}
          </div>
        </section>
      )
    }
  }
}
