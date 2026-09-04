import React from 'react'
import type { FAQBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'

interface FAQComponentProps {
  block: FAQBlock
  ctx: BlockContext
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the Q&A rows'
// item-heading/item-body are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals FAQ's pre-existing literal default, so an unstyled FAQ renders
// pixel-identical to before this system existed. HEADING_TYPE (text-2xl ->
// sm:3xl, bold, tight) is shared byte-for-byte across blocks — see
// src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/**
 * FAQ block — server component.
 * Accordion implemented with native <details>/<summary> — zero client JS.
 */
export function FAQComponent({ block }: FAQComponentProps) {
  const { heading, items } = block

  if (!items || items.length === 0) return null

  return (
    <section className="py-[var(--bs-section-pad,3rem)] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[var(--bs-section-width,48rem)]">
        {heading && (
          <h2 data-nb-part="heading" className={`mb-8 ${HEADING_TYPE} text-(--section-heading)`}>
            {heading}
          </h2>
        )}
        <div className="divide-y divide-(--color-border) rounded-(--radius-card) border border-(--color-border) overflow-hidden">
          {items.map((item) => (
            <details
              key={item.id}
              data-nb-part="item"
              className="group bg-(--color-surface)"
            >
              <summary data-nb-part="item-heading" className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-medium text-(--color-heading) hover:bg-(--color-surface-alt) transition-colors [&::-webkit-details-marker]:hidden">
                {item.question}
                {/* Chevron icon that flips when open */}
                <svg
                  className="h-5 w-5 flex-shrink-0 text-(--color-text-muted) transition-transform duration-200 group-open:rotate-180"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div data-nb-part="item-body" className="px-6 pb-5 pt-1 text-(--color-text-muted) leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
