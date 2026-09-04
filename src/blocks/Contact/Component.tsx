import React from 'react'
import type { ContactBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { safeHref } from '@/lib/safe-href'
import { HEADING_2XL as HEADING_TYPE, BODY_SM as BODY_TYPE } from '@/blocks/shared/vocab-classes'

interface ContactComponentProps {
  block: ContactBlock
  ctx: BlockContext
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only. See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals Contact's pre-existing literal default, so an unstyled Contact
// renders pixel-identical to before this system existed. HEADING_TYPE
// (text-2xl -> sm:text-3xl, bold, tight) and BODY_TYPE (text-sm, normal
// weight/tracking) are shared byte-for-byte across blocks — see
// src/blocks/shared/vocab-classes.ts. MEDIA_VISUAL stays local: its radius
// fallback (0.25rem) is unique to Contact.
// ---------------------------------------------------------------------------

/** Map iframe radius/shadow/blend — always safe to consume; fallback is today's un-rounded, un-shadowed embed. */
const MEDIA_VISUAL =
  'rounded-[var(--bs-media-radius,var(--bs-media-layout-radius,0.25rem))] ' +
  'shadow-[var(--bs-media-shadow,none)] [mix-blend-mode:var(--bs-media-blend,normal)]'

/**
 * Contact / Location block — server component, display-only (no form/submit).
 *
 * Renders address, hours, and tel:/wa.me/mailto: links plus an optional
 * Google Maps iframe, in one of four layouts. Styling uses only the
 * per-store theme CSS vars set by <StoreTheme> (--color-primary,
 * --color-accent, --color-surface, --color-text, --font-body,
 * --font-heading, --radius-button) with fallbacks — no hardcoded brand
 * colors. Renders null when there is nothing to show at all.
 */
export function ContactComponent({ block }: ContactComponentProps) {
  const { variant, heading, address, hours, phone, whatsapp, email, mapEmbedUrl } = block

  const hasAddress = !!address
  const hasHours = !!hours?.length
  const hasContacts = !!(phone || whatsapp || email)
  const safeMapEmbedUrl = safeHref(mapEmbedUrl)
  const hasMap = !!safeMapEmbedUrl

  if (!hasAddress && !hasHours && !hasContacts) return null

  const whatsappDigits = whatsapp ? whatsapp.replace(/\D/g, '') : ''

  // Render helpers (plain functions, not nested components) reused across the
  // variant layouts below — they close over the block's fields.
  const renderDetails = (center = false) => (
      <div className={`flex flex-col gap-4 ${center ? 'items-center text-center' : ''}`}>
        {heading && (
          <h2 data-nb-part="heading" className={`${HEADING_TYPE} text-(--section-heading)`}>
            {heading}
          </h2>
        )}
        {hasAddress && <p data-nb-part="body" className={`whitespace-pre-line leading-relaxed opacity-80 ${BODY_TYPE}`}>{address}</p>}
        {hasHours && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {hours!.map((h, i) => (
              <React.Fragment key={i}>
                <dt className="font-semibold">{h.label}</dt>
                <dd className="opacity-80">{h.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {hasContacts && (
          <div className={`flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium ${center ? 'justify-center' : ''}`}>
            {phone && (
              <a href={`tel:${phone}`} data-nb-part="link" className="underline-offset-2 hover:underline text-(--color-accent)">
                {phone}
              </a>
            )}
            {whatsappDigits && (
              <a
                href={`https://wa.me/${whatsappDigits}`}
                data-nb-part="link"
                className="underline-offset-2 hover:underline text-(--color-accent)"
              >
                WhatsApp
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} data-nb-part="link" className="underline-offset-2 hover:underline text-(--color-accent)">
                {email}
              </a>
            )}
          </div>
        )}
      </div>
  )

  const renderMap = () => {
    if (!hasMap) return null
    return (
      <iframe
        src={safeMapEmbedUrl!}
        loading="lazy"
        title={heading || 'Map'}
        data-nb-part="media"
        className={`w-full border-0 ${MEDIA_VISUAL}`}
        style={{ aspectRatio: '16 / 9' }}
      />
    )
  }

  switch (variant) {
    // Compact horizontal strip: heading, address, hours, and contacts inline. No map.
    case 'banner': {
      return (
        <section
          className="flex flex-wrap items-center justify-between gap-6 px-4 py-[var(--bs-section-pad,1.5rem)] sm:px-6 lg:px-8"
          style={{ background: 'var(--color-surface, #f9fafb)' }}
        >
          {renderDetails()}
        </section>
      )
    }

    // Centered details only, no map, regardless of whether mapEmbedUrl is set.
    case 'detailsOnly': {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[var(--bs-section-width,36rem)]">
            {renderDetails(true)}
          </div>
        </section>
      )
    }

    // Details on top, full-width map below.
    case 'mapStacked': {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[var(--bs-section-width,56rem)] flex-col gap-8">
            {renderDetails()}
            {renderMap()}
          </div>
        </section>
      )
    }

    // Details and map side by side (default).
    case 'mapSplit':
    default: {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          <div className={`mx-auto max-w-[var(--bs-section-width,72rem)] gap-8 ${hasMap ? 'grid grid-cols-1 md:grid-cols-2 md:items-center' : ''}`}>
            {renderDetails()}
            {renderMap()}
          </div>
        </section>
      )
    }
  }
}
