import React from 'react'
import Link from 'next/link'
import type { LogoStripBlock, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaSrcSet } from '@/lib/image'
import { safeHref } from '@/lib/safe-href'
import { HEADING_XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'
import './marquee.css'

interface LogoStripComponentProps {
  block: LogoStripBlock
  ctx: BlockContext
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the logo images
// are item-media and deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals LogoStrip's pre-existing literal default, so an unstyled
// LogoStrip block renders pixel-identical to before this system existed.
// HEADING_TYPE (text-xl -> sm:2xl, bold, tight) is shared byte-for-byte
// across blocks — see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/** Section vertical padding — py-14 across every variant. */
const SECTION_PAD = 'py-[var(--bs-section-pad,3.5rem)]'
/** Content max-width — max-w-5xl on the grid/bordered/staticRow variants. */
const SECTION_WIDTH = 'max-w-[var(--bs-section-width,64rem)]'

type ResolvedLogo = {
  key: string | number
  url: string
  alt: string
  href: string | null
  /** undefined for logos uploaded before ingest processing generated variants. */
  srcSet: string | undefined
}

/**
 * Logo / Trust strip block — server component.
 *
 * Renders one of four layout variants (staticRow, grid, marquee, bordered)
 * from the same content fields. Styling uses only the per-store theme CSS
 * vars set by <StoreTheme> (--color-text, --font-body, --font-heading) with
 * sane fallbacks — no hardcoded brand colors or fonts.
 */
export function LogoStripComponent({ block }: LogoStripComponentProps) {
  const { variant, heading, grayscale, logos } = block

  const resolved: ResolvedLogo[] = (logos ?? [])
    .map((logo, i) => {
      const media = logo.image !== null && typeof logo.image === 'object' ? (logo.image as Media) : null
      const url = media && 'url' in media ? media.url : null
      if (!url) return null
      return {
        key: logo.id ?? i,
        url,
        alt: logo.label ?? media?.alt ?? '',
        srcSet: mediaSrcSet(media),
        href: safeHref(logo.href) ?? null,
      }
    })
    .filter((l): l is ResolvedLogo => l !== null)

  if (resolved.length === 0) return null

  const grayscaleOn = grayscale ?? true
  const imgClassName = `h-8 w-auto object-contain transition sm:h-10 ${
    grayscaleOn ? 'grayscale opacity-70 hover:grayscale-0 hover:opacity-100' : ''
  }`

  const Heading = heading ? (
    <h2 data-nb-part="heading" className={`mb-8 text-center ${HEADING_TYPE} text-(--section-heading)`}>
      {heading}
    </h2>
  ) : null

  function LogoImage({ logo }: { logo: ResolvedLogo }) {
    const img = (
      // Tenant-uploaded logo on a per-tenant host; next/image's remote allowlist
      // is not a fit here.
      <img
        src={logo.url}
        srcSet={logo.srcSet}
        sizes="200px"
        alt={logo.alt}
        data-nb-part="item-media"
        className={imgClassName}
        loading="lazy"
      />
    )
    if (!logo.href) return img
    return (
      <Link href={logo.href} className="inline-flex items-center">
        {img}
      </Link>
    )
  }

  switch (variant) {
    // Even grid of logos, wrapping responsively.
    case 'grid': {
      return (
        <section className={`px-4 ${SECTION_PAD} sm:px-6 lg:px-8`}>
          {Heading}
          <div className={`mx-auto grid ${SECTION_WIDTH} grid-cols-2 items-center justify-items-center gap-8 sm:grid-cols-4`}>
            {resolved.map((logo) => (
              <LogoImage key={logo.key} logo={logo} />
            ))}
          </div>
        </section>
      )
    }

    // Cells separated by vertical dividers.
    case 'bordered': {
      return (
        <section className={`px-4 ${SECTION_PAD} sm:px-6 lg:px-8`}>
          {Heading}
          <div
            className={`mx-auto flex ${SECTION_WIDTH} flex-wrap items-center justify-center divide-x`}
            style={{ borderColor: 'var(--color-text, #111827)' }}
          >
            {resolved.map((logo) => (
              <div key={logo.key} data-nb-part="item" className="flex items-center justify-center px-6 py-2 sm:px-10">
                <LogoImage logo={logo} />
              </div>
            ))}
          </div>
        </section>
      )
    }

    // Horizontally auto-scrolling track; the logo list is duplicated so the
    // loop is seamless. Disabled under prefers-reduced-motion (marquee.css).
    case 'marquee': {
      const track = [...resolved, ...resolved]
      return (
        <section className={`overflow-hidden ${SECTION_PAD}`}>
          {Heading}
          <div className="mx-auto max-w-full overflow-hidden">
            <div className="logo-marquee-track flex w-max items-center gap-12">
              {track.map((logo, i) => (
                <div key={`${logo.key}-${i}`} data-nb-part="item" className="flex shrink-0 items-center">
                  <LogoImage logo={logo} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    // Simple centered row that wraps on narrow viewports.
    case 'staticRow':
    default: {
      return (
        <section className={`px-4 ${SECTION_PAD} sm:px-6 lg:px-8`}>
          {Heading}
          <div className={`mx-auto flex ${SECTION_WIDTH} flex-wrap items-center justify-center gap-8 sm:gap-12`}>
            {resolved.map((logo) => (
              <LogoImage key={logo.key} logo={logo} />
            ))}
          </div>
        </section>
      )
    }
  }
}
