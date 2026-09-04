import type { SectionScheme } from '@/blocks/lib/colorScheme'

/**
 * The section recipe vocabulary (Plan: recipe language, Task 1).
 *
 * This is deliberately a small slice of the full spec vocabulary: `richText`,
 * `video`, `rating`, `price` atoms; container `background`/`minHeight`;
 * `header.media`; `header.cta`; `masonry`; and product/category sources are
 * all listed in the spec but NOT here — each needs either the storefront data
 * layer or a media/lexical dependency that this task does not wire up. A later
 * plan adds them. Do not extend this file to cover them.
 */

export type Size = 'sm' | 'md' | 'lg'
export type Gap = 'tight' | 'normal' | 'roomy'

/** A named, merchant-editable hole in the recipe. Each one becomes a field on the instance form. */
export type SlotRef = { name: string; label: string }

export type Atom =
  | { kind: 'media'; aspect: '1:1' | '4:5' | '3:2' | '16:9'; fit: 'cover' | 'contain'; slot?: SlotRef }
  | { kind: 'icon'; slot: SlotRef }
  | { kind: 'heading'; level: 2 | 3 | 4; size: Size; slot: SlotRef }
  | { kind: 'text'; size: Size; slot: SlotRef }
  | { kind: 'eyebrow'; slot: SlotRef }
  | { kind: 'badge'; source: 'index' | 'slot'; slot?: SlotRef }
  | { kind: 'link'; slot: SlotRef; hrefSlot: SlotRef }
  | { kind: 'button'; style: 'primary' | 'ghost'; slot: SlotRef; hrefSlot: SlotRef }

export type SectionRecipe = {
  version: 1
  container: {
    width: 'full' | 'wide' | 'narrow'
    padding: 'tight' | 'normal' | 'roomy'
    scheme: SectionScheme
    align: 'start' | 'center'
  }
  header?: { eyebrow?: SlotRef; heading?: SlotRef; body?: SlotRef }
  items?: {
    source: { kind: 'static'; count: number }
    layout: { pattern: 'grid' | 'row' | 'stack'; columns: { mobile: number; tablet: number; desktop: number }; gap: Gap }
    template: Atom[]
  }
}
