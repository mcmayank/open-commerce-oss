import React from 'react'
import type { IncentivesBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { INCENTIVE_ICONS } from './icons'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'

const COLS: Record<string, string> = {
  '2': 'sm:grid-cols-2',
  '3': 'sm:grid-cols-3',
  '4': 'sm:grid-cols-2 lg:grid-cols-4',
}

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the tiles' item-
// heading/item-body/item-media are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals Incentives' pre-existing literal default, so an unstyled
// Incentives strip renders pixel-identical to before this system existed.
// HEADING_TYPE (text-2xl -> sm:3xl, bold, tight) is shared byte-for-byte
// across blocks — see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/**
 * Incentives block — server component.
 *
 * Renders an inline icon+label trust-badge strip. Scheme-aware: reads the
 * section color tokens (--section-*) set by the RenderBlocks wrapper, plus the
 * per-tenant brand tokens (--color-accent for the icons). No hardcoded colors.
 */
export function IncentivesComponent({ block }: { block: IncentivesBlock; ctx: BlockContext }) {
  const { heading, columns, items } = block
  if (!items?.length) return null
  const cols = COLS[columns] ?? COLS['4']

  return (
    <section className="px-4 py-[var(--bs-section-pad,3rem)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[var(--bs-section-width,72rem)]">
        {heading && (
          <h2 data-nb-part="heading" className={`mb-8 text-center ${HEADING_TYPE} text-(--section-heading)`}>
            {heading}
          </h2>
        )}
        <div className={`grid grid-cols-1 gap-x-8 gap-y-6 ${cols}`}>
          {items.map((item) => {
            const Icon = INCENTIVE_ICONS[item.icon] ?? INCENTIVE_ICONS.truck
            return (
              <div key={item.id} data-nb-part="item" className="flex items-start gap-4">
                <span data-nb-part="item-media" className="shrink-0 text-(--color-accent)" aria-hidden="true">
                  <Icon />
                </span>
                <div className="min-w-0">
                  <h3 data-nb-part="item-heading" className="text-base font-semibold text-(--section-heading)">{item.heading}</h3>
                  {item.text && (
                    <p data-nb-part="item-body" className="mt-1 text-sm leading-relaxed text-(--section-muted)">{item.text}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
