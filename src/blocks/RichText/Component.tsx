import React from 'react'
import type { RichTextBlock } from '@/payload-types'
import type { BlockContext } from '@/blocks/index'
import { SharedRichText } from '@/blocks/lib/RichText'

interface RichTextComponentProps {
  block: RichTextBlock
  ctx: BlockContext
}

/**
 * RichText block — server component.
 * Renders the stored lexical `content` via the shared lexical-to-JSX renderer
 * (same package used on the product detail page).
 */
export function RichTextComponent({ block }: RichTextComponentProps) {
  if (!block.content) return null

  return (
    <div className="mx-auto max-w-[var(--bs-section-width,48rem)] px-6 py-[var(--bs-section-pad,3rem)]">
      <div data-nb-part="body" className="text-(--color-text)">
        {/* `store-prose` sits on the renderer's wrapper so its `>` rhythm rules
            match the lexical nodes directly — see globals.css. */}
        <SharedRichText data={block.content} className="store-prose" />
      </div>
    </div>
  )
}
