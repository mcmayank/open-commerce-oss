import React from 'react'
import type { FeatureGridBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { FEATURE_ICONS } from './icons'
import { HEADING_2XL as HEADING_TYPE } from '@/blocks/shared/vocab-classes'

const COLS: Record<string, string> = { '2': 'sm:grid-cols-2', '3': 'sm:grid-cols-3', '4': 'sm:grid-cols-2 lg:grid-cols-4' }

// ---------------------------------------------------------------------------
// Block-style (`--bs-*`) consumption — section-level only (the item cards'
// item-heading/item-body/item-media are deliberately NOT wired here). See
// src/blocks/Hero/Component.tsx for the full pattern writeup. Every fallback
// below equals FeatureGrid's pre-existing literal default, so an unstyled
// FeatureGrid renders pixel-identical to before this system existed.
// HEADING_TYPE (text-2xl -> sm:3xl, bold, tight) is shared byte-for-byte
// across blocks — see src/blocks/shared/vocab-classes.ts.
// ---------------------------------------------------------------------------

export function FeatureGridComponent({ block }: { block: FeatureGridBlock; ctx: BlockContext }) {
  const { variant, heading, columns, items } = block
  if (!items?.length && !heading) return null
  const cols = COLS[columns] ?? COLS['3']
  const v = variant ?? 'iconTop'
  const iconLeft = v === 'iconLeft'
  const card = v === 'cards'
  const showIcon = v !== 'minimal'

  return (
    <section className="px-4 py-[var(--bs-section-pad,3.5rem)] sm:px-6 lg:px-8">
      {heading && (
        <h2 data-nb-part="heading" className={`mb-10 text-center ${HEADING_TYPE} text-(--section-heading)`}>{heading}</h2>
      )}
      <div className={`mx-auto grid max-w-[var(--bs-section-width,72rem)] grid-cols-1 gap-6 ${cols}`}>
        {(items ?? []).map((item, i) => {
          const Icon = FEATURE_ICONS[item.icon] ?? FEATURE_ICONS.star
          return (
            <div key={i}
              data-nb-part="item"
              className={`flex gap-4 ${iconLeft ? 'flex-row items-start' : 'flex-col items-center text-center'} ${card ? 'border p-6' : ''}`}
              style={card ? { borderColor: 'var(--color-text,#111827)', borderRadius: 'var(--radius-button,0.5rem)', background: 'var(--color-surface,#fff)' } : undefined}>
              {showIcon && (
                <div data-nb-part="item-media" className="shrink-0 text-(--color-accent)"><Icon /></div>
              )}
              <div className={iconLeft ? '' : 'flex flex-col items-center'}>
                <h3 data-nb-part="item-heading" className="text-base font-semibold text-(--section-heading)">{item.heading}</h3>
                {item.text && <p data-nb-part="item-body" className="mt-1 text-sm leading-relaxed opacity-75">{item.text}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
