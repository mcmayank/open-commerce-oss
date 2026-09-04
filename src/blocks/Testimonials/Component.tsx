import React from 'react'
import type { TestimonialsBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'

interface TestimonialsComponentProps {
  block: TestimonialsBlock
  ctx: BlockContext
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the cards' item-
// heading/item-body are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals Testimonials' pre-existing literal default, so an unstyled
// Testimonials block renders pixel-identical to before this system existed.
// HEADING_TYPE (text-2xl -> sm:3xl, bold, tight) is shared byte-for-byte
// across blocks — see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/**
 * Testimonials block — server component.
 * Renders a card grid of customer quotes.
 */
export function TestimonialsComponent({ block }: TestimonialsComponentProps) {
  const { heading, items } = block

  if (!items || items.length === 0) return null

  return (
    <section className="py-[var(--bs-section-pad,3rem)] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
        {heading && (
          <h2 data-nb-part="heading" className={`mb-10 text-center ${HEADING_TYPE} text-(--section-heading)`}>
            {heading}
          </h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              data-nb-part="item"
              className="flex flex-col gap-4 rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-6 shadow-sm"
            >
              {/* Quote mark */}
              <span className="text-4xl font-serif leading-none text-(--color-accent) select-none" aria-hidden="true">
                &ldquo;
              </span>
              <p data-nb-part="item-body" className="flex-1 text-(--section-fg) leading-relaxed italic">{item.quote}</p>
              <div className="border-t border-(--color-border) pt-4">
                <p data-nb-part="item-heading" className="font-semibold text-(--section-heading)">{item.author}</p>
                {item.role && (
                  <p className="text-sm text-(--section-muted)">{item.role}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
