import React from 'react'
import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import type { FeaturedProductBlock, Media, Product } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaDimensions, mediaSrcSet } from '@/lib/image'
import { MEDIA_STANDARD as MEDIA_VISUAL } from '@/blocks/shared/vocab-classes'
import { storeIdOf } from '@/store-scope'

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only. See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals FeaturedProduct's pre-existing literal default, so an unstyled
// FeaturedProduct renders pixel-identical to before this system existed.
// MEDIA_VISUAL (radius fallback 0, un-rounded) is shared byte-for-byte
// across blocks — see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/** Heading typography for imageLeft/imageRight/stacked: text-3xl, extrabold, tight. */
const HEADING_TYPE_COMPACT =
  'text-[length:var(--bs-heading-size,1.875rem)] font-[weight:var(--bs-heading-weight,800)] ' +
  'tracking-[var(--bs-heading-tracking,-0.025em)] [font-family:var(--bs-heading-font,inherit)] ' +
  '[font-style:var(--bs-heading-style,normal)] [text-transform:var(--bs-heading-transform,none)]'

/** Heading typography for overlay: text-4xl, extrabold, tight. */
const HEADING_TYPE_LARGE =
  'text-[length:var(--bs-heading-size,2.25rem)] font-[weight:var(--bs-heading-weight,800)] ' +
  'tracking-[var(--bs-heading-tracking,-0.025em)] [font-family:var(--bs-heading-font,inherit)] ' +
  '[font-style:var(--bs-heading-style,normal)] [text-transform:var(--bs-heading-transform,none)]'

/** Price body typography — text-2xl, semibold, identical across compact and overlay. */
const BODY_TYPE =
  'text-[length:var(--bs-subheading-size,1.5rem)] font-[weight:var(--bs-subheading-weight,600)] ' +
  'tracking-[var(--bs-subheading-tracking,0em)] [font-family:var(--bs-subheading-font,inherit)] ' +
  '[font-style:var(--bs-subheading-style,normal)] [text-transform:var(--bs-subheading-transform,none)]'

export function FeaturedProductComponent({ block, ctx }: { block: FeaturedProductBlock; ctx: BlockContext }) {
  const { variant, product, headingOverride, ctaLabel } = block
  // depth:2 populates the relationship; bail if it's an id or missing.
  if (!product || typeof product !== 'object' || !('id' in product)) return null
  const p = product as Product
  // Defensive tenant check (mirrors ProductGridComponent).
  const productTenantId = storeIdOf(p)
  if (String(productTenantId) !== String(ctx.tenantId)) return null

  const firstImage = p.images?.length && typeof p.images[0] === 'object' ? (p.images[0] as Media) : null
  const imageUrl = firstImage?.url ?? null
  const href = `/products/${p.slug}`
  const v = variant ?? 'imageLeft'
  const radius: React.CSSProperties = { borderRadius: 'var(--radius-button, 0.5rem)' }

  const image = imageUrl ? (
    <img
      src={imageUrl}
      srcSet={mediaSrcSet(firstImage)}
      sizes="(min-width: 768px) 50vw, 100vw"
      width={mediaDimensions(firstImage)?.width}
      height={mediaDimensions(firstImage)?.height}
      alt={firstImage?.alt ?? p.title}
      data-nb-part="media"
      className={`h-full w-full object-cover ${MEDIA_VISUAL}`}
      loading="lazy"
    />
  ) : <div data-nb-part="media" className={`h-full w-full bg-[var(--color-surface,#f3f4f6)] ${MEDIA_VISUAL}`} />

  const details = (
    <div className="flex flex-col justify-center gap-4 px-8 py-[var(--bs-section-pad,3rem)]">
      <h2 data-nb-part="heading" className={`${HEADING_TYPE_COMPACT} text-(--section-heading)`}>
        {headingOverride || p.title}
      </h2>
      <p data-nb-part="body" className={`${BODY_TYPE} text-(--color-primary)`}>{formatMoney(p.price, ctx.currency)}</p>
      <div>
        <Link href={href} data-nb-part="cta" className="inline-block px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ ...radius, background: 'var(--color-accent, #2563eb)' }}>{ctaLabel || 'View'}</Link>
      </div>
    </div>
  )

  if (v === 'overlay') {
    return (
      <section className="relative flex min-h-[420px] items-center overflow-hidden">
        <div className="absolute inset-0">{image}</div>
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[var(--bs-section-width,42rem)] px-6 text-center text-white">
          <h2 data-nb-part="heading" className={HEADING_TYPE_LARGE}>{headingOverride || p.title}</h2>
          <p data-nb-part="body" className={`mt-3 ${BODY_TYPE}`}>{formatMoney(p.price, ctx.currency)}</p>
          <Link href={href} data-nb-part="cta" className="mt-6 inline-block px-8 py-3 text-sm font-semibold text-white hover:opacity-90" style={{ ...radius, background: 'var(--color-accent, #2563eb)' }}>{ctaLabel || 'View'}</Link>
        </div>
      </section>
    )
  }
  if (v === 'stacked') {
    return (
      <section className="flex flex-col">
        <div className="h-64 w-full sm:h-80">{image}</div>
        <div className="text-center">{details}</div>
      </section>
    )
  }
  const isRight = v === 'imageRight'
  return (
    <section className="grid min-h-[420px] grid-cols-1 md:grid-cols-2">
      <div className={`min-h-[260px] md:min-h-0 ${isRight ? 'md:order-2' : ''}`}>{image}</div>
      <div className={isRight ? 'md:order-1' : ''}>{details}</div>
    </section>
  )
}
