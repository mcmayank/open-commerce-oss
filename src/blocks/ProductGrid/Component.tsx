import React from 'react'
import type { ProductGridBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { listProducts } from '@/lib/storefront'
import ProductCard from '@/app/(storefront)/store/[tenant]/components/ProductCard'
import type { Product } from '@/payload-types'
import { storeIdOf } from '@/store-scope'

interface ProductGridComponentProps {
  block: ProductGridBlock
  ctx: BlockContext
}

const GRID_COLS: Record<string, string> = {
  '2': 'sm:grid-cols-2',
  '3': 'grid-cols-2 sm:grid-cols-3',
  '4': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}

/**
 * ProductGrid block — server component.
 *
 * Fetches products via ctx.tenantId + listProducts (tenant-scoped, active-only).
 * Reuses the Phase 2 ProductCard component. Renders one of three layouts
 * (grid / carousel / list) from the same products.
 */
export async function ProductGridComponent({ block, ctx }: ProductGridComponentProps) {
  const { variant, columns, eyebrow, heading, source, category, products: manualProducts, limit } = block
  const productLimit = limit ?? 8

  let products: Product[] = []

  if (source === 'latest') {
    products = await listProducts(ctx.tenantId, { limit: productLimit })
  } else if (source === 'category') {
    const categoryId =
      category !== null && typeof category === 'object' && 'id' in category
        ? category.id
        : (category as string | number | undefined)
    if (categoryId) {
      products = await listProducts(ctx.tenantId, { categoryId, limit: productLimit })
    }
  } else if (source === 'manual') {
    // manualProducts are populated at depth 1 — filter to ensure they belong to this tenant and are active
    if (Array.isArray(manualProducts)) {
      products = manualProducts
        .map((p) => (typeof p === 'object' && p !== null && 'id' in p ? (p as Product) : null))
        .filter((p): p is Product => {
          if (!p) return false
          if (p.status !== 'active') return false
          // Defensive tenant check
          const productTenantId =
            storeIdOf(p)
          return String(productTenantId) === String(ctx.tenantId)
        })
    }
  }

  if (products.length === 0 && !heading) return null

  const v = variant ?? 'grid'

  const Heading = eyebrow || heading ? (
    <div className="mb-8">
      {eyebrow && (
        <p data-nb-part="eyebrow" className="mb-2 text-[length:var(--bs-eyebrow-size,0.875rem)] font-[weight:var(--bs-eyebrow-weight,600)] [text-transform:var(--bs-eyebrow-transform,uppercase)] tracking-[var(--bs-eyebrow-tracking,0.2em)] [font-family:var(--bs-eyebrow-font,inherit)] [font-style:var(--bs-eyebrow-style,normal)] text-(--color-accent)">{eyebrow}</p>
      )}
      {heading && (
        <h2 data-nb-part="heading" className="text-[length:var(--bs-heading-size,1.5rem)] sm:text-[length:var(--bs-heading-size,1.875rem)] font-[weight:var(--bs-heading-weight,700)] tracking-[var(--bs-heading-tracking,-0.025em)] [font-family:var(--bs-heading-font,inherit)] [font-style:var(--bs-heading-style,normal)] [text-transform:var(--bs-heading-transform,none)] text-(--section-heading)">
          {heading}
        </h2>
      )}
    </div>
  ) : null

  let content: React.ReactNode
  if (products.length === 0) {
    content = <p className="text-(--section-muted)">No products to display.</p>
  } else if (v === 'carousel') {
    // Horizontal scroll-snap row — no JS needed. Each card gets a fixed-ish width.
    content = (
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {products.map((product) => (
          <div key={product.id} data-nb-part="item" className="w-44 shrink-0 snap-start sm:w-56">
            <ProductCard product={product} currency={ctx.currency} />
          </div>
        ))}
      </div>
    )
  } else if (v === 'list') {
    // Fewer, larger cards in a single/two-column stack.
    content = (
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={ctx.currency} />
        ))}
      </div>
    )
  } else {
    const cols = GRID_COLS[columns ?? '4'] ?? GRID_COLS['4']
    content = (
      <div className={`grid gap-4 ${cols}`}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={ctx.currency} />
        ))}
      </div>
    )
  }

  return (
    <section className="py-[var(--bs-section-pad,3rem)] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
        {Heading}
        {content}
      </div>
    </section>
  )
}
