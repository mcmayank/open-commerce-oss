import React from 'react'
import Link from 'next/link'
import type { ReviewsBlock, Product } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'
import { storeIdOf } from '@/store-scope'

type ReviewItem = NonNullable<ReviewsBlock['items']>[number]

/** Five stars, filled up to `rating`. Uses --color-accent for filled stars. */
function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <div className="flex gap-0.5" aria-label={`${r} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill={i <= r ? 'var(--color-accent, #f59e0b)' : 'none'}
          stroke={i <= r ? 'var(--color-accent, #f59e0b)' : 'var(--color-border, #d1d5db)'}
          strokeWidth={1.4}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.6 1-5.8L1.5 7.7l5.9-.9z" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  )
}

function reviewProduct(product: ReviewItem['product'], ctx: BlockContext) {
  // Populated at depth 2; only link when it resolves to a same-tenant product.
  if (!product || typeof product !== 'object' || !('id' in product)) return null
  const p = product as Product
  const tenantId = storeIdOf(p)
  if (String(tenantId) !== String(ctx.tenantId)) return null
  return { title: p.title, href: `/products/${p.slug}` }
}

function ReviewCard({
  item,
  ctx,
  className = '',
}: {
  item: ReviewItem
  ctx: BlockContext
  className?: string
}) {
  const linked = reviewProduct(item.product, ctx)
  return (
    <figure data-nb-part="item" className={`flex flex-col gap-3 rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-6 shadow-sm ${className}`}>
      <Stars rating={item.rating} />
      <blockquote data-nb-part="item-body" className="flex-1 leading-relaxed text-(--section-fg)">{item.quote}</blockquote>
      <figcaption className="border-t border-(--color-border) pt-3">
        <span data-nb-part="item-heading" className="font-semibold text-(--section-heading)">{item.author}</span>
        {item.role && <span className="ml-2 text-sm text-(--section-muted)">{item.role}</span>}
        {linked && (
          <div className="mt-1 text-sm">
            <Link href={linked.href} data-nb-part="link" className="text-(--color-primary) hover:underline">
              on {linked.title}
            </Link>
          </div>
        )}
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the ReviewCard's
// item-heading/item-body are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals Reviews' pre-existing literal default, so an unstyled Reviews
// block renders pixel-identical to before this system existed. HEADING_TYPE
// (text-2xl -> sm:3xl, bold, tight) is shared byte-for-byte across blocks —
// see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/**
 * Reviews block — server component.
 *
 * Renders editor-authored, star-rated reviews in one of three layouts. Reads
 * per-section (--section-*) and brand (--color-*) tokens; the optional product
 * link is tenant-checked before rendering.
 */
export function ReviewsComponent({ block, ctx }: { block: ReviewsBlock; ctx: BlockContext }) {
  const { variant, heading, items } = block
  if (!items?.length) return null
  const v = variant ?? 'cards'

  const Heading = heading ? (
    <h2 data-nb-part="heading" className={`mb-10 text-center ${HEADING_TYPE} text-(--section-heading)`}>
      {heading}
    </h2>
  ) : null

  if (v === 'list') {
    return (
      <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--bs-section-width,48rem)]">
          {Heading}
          <div className="flex flex-col gap-6">
            {items.map((item) => (
              <ReviewCard key={item.id} item={item} ctx={ctx} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (v === 'masonry') {
    return (
      <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
          {Heading}
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
            {items.map((item) => (
              <ReviewCard key={item.id} item={item} ctx={ctx} className="mb-6 break-inside-avoid" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Cards (default): even grid.
  return (
    <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
        {Heading}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} ctx={ctx} />
          ))}
        </div>
      </div>
    </section>
  )
}
