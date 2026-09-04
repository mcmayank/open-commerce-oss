import React from 'react'
import type { TickerBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import './marquee.css'

/**
 * Ticker block — server component.
 *
 * Renders short phrases separated by a divider, either as a centered static row
 * or a seamless auto-scrolling marquee (list duplicated so the loop is smooth;
 * disabled under prefers-reduced-motion via marquee.css). Reads the section
 * color tokens set by the RenderBlocks wrapper.
 *
 * Block-style (`--bs-*`) consumption is section-level only — the phrase/
 * separator items are item-level and deliberately NOT wired. Both variants'
 * section wrapper reads `--bs-section-pad`; the static variant's content
 * container additionally reads `--bs-section-width` (the marquee variant's
 * container is the full-bleed scroll track, not a content-width wrapper, so
 * it is left alone). See src/blocks/Hero/Component.tsx for the pattern.
 */
export function TickerComponent({ block }: { block: TickerBlock; ctx: BlockContext }) {
  const { variant, separator, items } = block
  const labels = (items ?? []).map((i) => i.label).filter(Boolean)
  if (labels.length === 0) return null
  const sep = separator || '·'

  const Phrase = ({ label }: { label: string }) => (
    <span data-nb-part="item" className="text-sm font-medium uppercase tracking-[0.18em] text-(--section-fg)">{label}</span>
  )
  const Sep = () => (
    <span className="text-(--section-muted)" aria-hidden="true">
      {sep}
    </span>
  )

  if (variant === 'marquee') {
    // Duplicate the list so the -50% scroll loops seamlessly.
    const track = [...labels, ...labels]
    return (
      <section className="overflow-hidden py-[var(--bs-section-pad,1rem)]">
        <div className="ticker-marquee-track flex w-max items-center gap-6">
          {track.map((label, i) => (
            <React.Fragment key={i}>
              <Phrase label={label} />
              <Sep />
            </React.Fragment>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 py-[var(--bs-section-pad,1rem)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[var(--bs-section-width,64rem)] flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {labels.map((label, i) => (
          <React.Fragment key={i}>
            <Phrase label={label} />
            {i < labels.length - 1 && <Sep />}
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}
