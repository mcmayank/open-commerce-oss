import React from 'react'
import type { StepsBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'

const COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

const badgeStyle: React.CSSProperties = { background: 'var(--color-primary, #111827)' }

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the badge/item-
// heading/item-body are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals Steps' pre-existing literal default, so an unstyled Steps
// block renders pixel-identical to before this system existed. HEADING_TYPE
// (text-2xl -> sm:3xl, bold, tight) is shared byte-for-byte across blocks —
// see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

/** Numbered circle badge; renders nothing when `numbered` is off so callers can lay out spacing accordingly. */
function Badge({ n, numbered }: { n: number; numbered: boolean }) {
  if (!numbered) return null
  return (
    <span
      data-nb-part="badge"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={badgeStyle}
    >
      {n}
    </span>
  )
}

/**
 * Steps / How it works block — server component.
 *
 * Renders one of four layout variants (horizontal, vertical, cards, compact)
 * from the same content fields. Styling uses only the per-store theme CSS
 * vars set by <StoreTheme> (--color-primary, --color-accent, --color-surface,
 * --color-text, --font-body, --font-heading, --radius-button) with sane
 * fallbacks — no hardcoded brand colors or fonts.
 */
export function StepsComponent({ block }: { block: StepsBlock; ctx: BlockContext }) {
  const { variant, heading, numbered, steps } = block
  if (!steps?.length && !heading) return null

  const numberedOn = numbered ?? true

  const Heading = heading ? (
    <h2 data-nb-part="heading" className={`mb-10 text-center ${HEADING_TYPE} text-(--section-heading)`}>
      {heading}
    </h2>
  ) : null

  switch (variant) {
    // Left-rail timeline: a vertical connector line with a node per step.
    case 'vertical': {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          {Heading}
          <ol className="relative mx-auto max-w-[var(--bs-section-width,42rem)]">
            {(steps ?? []).map((step, i) => (
              <li key={step.id ?? i} data-nb-part="item" className="relative flex gap-4 pb-10 last:pb-0">
                {i < (steps?.length ?? 0) - 1 && (
                  <span
                    className="absolute left-4 top-8 w-px -translate-x-1/2"
                    style={{ bottom: '-0.5rem', background: 'var(--color-text, #111827)', opacity: 0.15 }}
                    aria-hidden="true"
                  />
                )}
                <Badge n={i + 1} numbered={numberedOn} />
                <div className="pt-0.5">
                  <h3 data-nb-part="item-heading" className="text-base font-semibold text-(--section-heading)">
                    {step.title}
                  </h3>
                  {step.description && <p data-nb-part="item-body" className="mt-1 text-sm leading-relaxed opacity-75">{step.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )
    }

    // Bordered numbered cards grid.
    case 'cards': {
      const cols = COLS[Math.min(steps?.length ?? 3, 4) || 3] ?? COLS[3]
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          {Heading}
          <div className={`mx-auto grid max-w-[var(--bs-section-width,72rem)] grid-cols-1 gap-6 ${cols}`}>
            {(steps ?? []).map((step, i) => (
              <div
                key={step.id ?? i}
                data-nb-part="item"
                className="relative flex flex-col gap-2 border p-6"
                style={{
                  borderColor: 'var(--color-text, #111827)',
                  borderRadius: 'var(--radius-button, 0.5rem)',
                  background: 'var(--color-surface, #fff)',
                }}
              >
                <Badge n={i + 1} numbered={numberedOn} />
                <h3 data-nb-part="item-heading" className="text-base font-semibold text-(--section-heading)">
                  {step.title}
                </h3>
                {step.description && <p data-nb-part="item-body" className="mt-1 text-sm leading-relaxed opacity-75">{step.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )
    }

    // Stacked rows of badge + title/description.
    case 'compact': {
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          {Heading}
          <div className="mx-auto flex max-w-[var(--bs-section-width,42rem)] flex-col gap-6">
            {(steps ?? []).map((step, i) => (
              <div key={step.id ?? i} data-nb-part="item" className="flex items-start gap-4">
                <Badge n={i + 1} numbered={numberedOn} />
                <div>
                  <h3 data-nb-part="item-heading" className="text-base font-semibold text-(--section-heading)">
                    {step.title}
                  </h3>
                  {step.description && <p data-nb-part="item-body" className="mt-1 text-sm leading-relaxed opacity-75">{step.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }

    // Numbered items in a responsive row with a connector line behind them.
    case 'horizontal':
    default: {
      const cols = COLS[Math.min(steps?.length ?? 3, 4) || 3] ?? COLS[3]
      return (
        <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
          {Heading}
          <div className={`relative mx-auto grid max-w-[var(--bs-section-width,72rem)] grid-cols-1 gap-8 ${cols}`}>
            {(steps?.length ?? 0) > 1 && (
              <span
                className="absolute left-0 right-0 top-4 hidden h-px sm:block"
                style={{ background: 'var(--color-text, #111827)', opacity: 0.15 }}
                aria-hidden="true"
              />
            )}
            {(steps ?? []).map((step, i) => (
              <div key={step.id ?? i} data-nb-part="item" className="relative flex flex-col items-center gap-3 text-center">
                <Badge n={i + 1} numbered={numberedOn} />
                <div>
                  <h3 data-nb-part="item-heading" className="text-base font-semibold text-(--section-heading)">
                    {step.title}
                  </h3>
                  {step.description && <p data-nb-part="item-body" className="mt-1 text-sm leading-relaxed opacity-75">{step.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }
  }
}
