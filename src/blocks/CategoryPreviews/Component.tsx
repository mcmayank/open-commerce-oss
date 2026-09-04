import React from 'react'
import Link from 'next/link'
import type { CategoryPreviewsBlock, Category, Media } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { mediaSrcSet } from '@/lib/image'
import { listCategories } from '@/lib/storefront'

const GRID_COLS = 'grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'

function categoryImageUrl(cat: Category): {
  url: string | null
  alt: string
  /** undefined for images uploaded before ingest processing generated variants. */
  srcSet: string | undefined
} {
  const img = cat.image
  const media = img && typeof img === 'object' && 'url' in img ? (img as Media) : null
  return { url: media?.url ?? null, alt: media?.alt ?? cat.title, srcSet: mediaSrcSet(media) }
}

function ImageFallback() {
  return <div className="h-full w-full bg-(--color-surface-alt)" aria-hidden="true" />
}

/**
 * Category Previews block — server component.
 *
 * Loads the tenant's categories (tenant-scoped via listCategories) and links
 * each to the filtered product list. Manual selection reorders/filters that
 * list by the chosen ids, so tenant isolation always holds. Styling uses only
 * per-tenant theme + section CSS vars.
 */
export async function CategoryPreviewsComponent({
  block,
  ctx,
}: {
  block: CategoryPreviewsBlock
  ctx: BlockContext
}) {
  const { variant, heading, source, categories: manual, limit } = block

  const all = await listCategories(ctx.tenantId)
  let categories: Category[] = all

  if (source === 'manual' && Array.isArray(manual)) {
    // Preserve the editor's chosen order; drop any that don't resolve to a
    // real tenant category (defensive against stale/cross-tenant refs).
    const byId = new Map(all.map((c) => [String(c.id), c]))
    categories = manual
      .map((m) => (typeof m === 'object' && m !== null && 'id' in m ? String(m.id) : String(m)))
      .map((id) => byId.get(id))
      .filter((c): c is Category => Boolean(c))
  } else {
    categories = all.slice(0, limit ?? 6)
  }

  if (categories.length === 0) return null

  const href = (cat: Category) => `/products?category=${encodeURIComponent(cat.slug)}`
  const v = variant ?? 'grid'

  const Heading = heading ? (
    <h2
      data-nb-part="heading"
      className="mb-8 text-[length:var(--bs-heading-size,1.5rem)] sm:text-[length:var(--bs-heading-size,1.875rem)] font-[weight:var(--bs-heading-weight,700)] tracking-[var(--bs-heading-tracking,-0.025em)] [font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] [text-transform:var(--bs-heading-transform,none)] text-(--section-heading)"
    >
      {heading}
    </h2>
  ) : null

  // List: horizontal rows — image thumbnail + title/description.
  if (v === 'list') {
    return (
      <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--bs-section-width,56rem)]">
          {Heading}
          <ul className="flex flex-col divide-y divide-(--color-border)">
            {categories.map((cat) => {
              const { url, alt, srcSet } = categoryImageUrl(cat)
              return (
                <li key={cat.id} data-nb-part="item">
                  <Link href={href(cat)} className="group flex items-center gap-5 py-4">
                    <div data-nb-part="item-media" className="h-20 w-20 shrink-0 overflow-hidden rounded-(--radius-card)">
                      {url ? (
                        <img
                          src={url}
                          srcSet={srcSet}
                          sizes="80px"
                          alt={alt}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <ImageFallback />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 data-nb-part="item-heading" className="font-semibold text-(--section-heading) group-hover:opacity-80">{cat.title}</h3>
                      {cat.description && (
                        <p data-nb-part="item-body" className="mt-1 line-clamp-2 text-sm text-(--section-muted)">{cat.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    )
  }

  // Overlay cards: image with title overlaid on a scrim.
  if (v === 'overlayCards') {
    return (
      <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
          {Heading}
          <div className={`grid ${GRID_COLS}`}>
            {categories.map((cat) => {
              const { url, alt, srcSet } = categoryImageUrl(cat)
              return (
                <Link
                  key={cat.id}
                  href={href(cat)}
                  data-nb-part="item"
                  className="group relative flex aspect-square overflow-hidden rounded-(--radius-card)"
                >
                  {url ? (
                    <img
                      src={url}
                      srcSet={srcSet}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      alt={alt}
                      data-nb-part="item-media"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <ImageFallback />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/0" aria-hidden="true" />
                  <span data-nb-part="item-heading" className="relative z-10 mt-auto p-4 text-lg font-semibold text-white">{cat.title}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  // Grid (default): image tile with the title below.
  return (
    <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
        {Heading}
        <div className={`grid ${GRID_COLS}`}>
          {categories.map((cat) => {
            const { url, alt, srcSet } = categoryImageUrl(cat)
            return (
              <Link key={cat.id} href={href(cat)} data-nb-part="item" className="group flex flex-col">
                <div data-nb-part="item-media" className="aspect-square overflow-hidden rounded-(--radius-card) bg-(--color-surface-alt)">
                  {url ? (
                    <img
                      src={url}
                      srcSet={srcSet}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      alt={alt}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <ImageFallback />
                  )}
                </div>
                <h3 data-nb-part="item-heading" className="mt-3 text-center font-medium text-(--section-heading) group-hover:opacity-80">{cat.title}</h3>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
