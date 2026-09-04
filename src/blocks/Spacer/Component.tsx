import React from 'react'
import type { SpacerBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'

const SIZES: Record<string, string> = { sm: '1.5rem', md: '3rem', lg: '5rem', xl: '8rem' }

export function SpacerComponent({ block }: { block: SpacerBlock; ctx: BlockContext }) {
  const pad = SIZES[block.size] ?? SIZES.md
  const rule = (() => {
    switch (block.variant) {
      case 'line':
        return <hr className="mx-auto w-full max-w-5xl border-t" style={{ borderColor: 'var(--color-text, #111827)', opacity: 0.15 }} />
      case 'dots':
        return (
          <div className="flex justify-center gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-text, #111827)', opacity: 0.3 }} />
            ))}
          </div>
        )
      case 'gradient':
        return <div className="mx-auto h-px w-full max-w-3xl" style={{ background: 'linear-gradient(to right, transparent, var(--color-accent, #2563eb), transparent)' }} />
      case 'blank':
      default:
        return null
    }
  })()
  return <div style={{ paddingTop: pad, paddingBottom: pad }}>{rule}</div>
}
