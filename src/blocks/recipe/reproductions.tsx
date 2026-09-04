import type { ReactElement } from 'react'
import type { SectionRecipe } from './types'
import type { RecipeContent } from './RecipeSection'
import type { RecipeMediaDoc } from './atoms'
import { fixtureCtx } from '@/blocks/test-fixtures'
import { TestimonialsComponent } from '@/blocks/Testimonials/Component'
import { FeatureGridComponent } from '@/blocks/FeatureGrid/Component'
import { IncentivesComponent } from '@/blocks/Incentives/Component'
import { StepsComponent } from '@/blocks/Steps/Component'
import { ImageGalleryComponent } from '@/blocks/ImageGallery/Component'

/**
 * Task 4: reproduces five shipped, hand-built blocks as recipes, to make the
 * spec's claim that 18/23 blocks are expressible in this vocabulary
 * (Tasks 1-3) an executable check instead of a hand-audited one.
 *
 * Each `original()` renders the real Component with fixture props reused
 * from `src/blocks/test-fixtures.tsx` — its entries are known-good, having
 * already been corrected against each block's `config.ts` (that file's own
 * comments document a real bug class: inferring field names from a
 * component's destructuring instead of its Payload field config, e.g. Steps'
 * `steps: [{title, description}]` vs a wrongly-assumed `items: [{heading,
 * text}]`). `recipe`/`content` build the equivalent section from this plan's
 * recipe language, read from the same `config.ts` files directly.
 *
 * `reproductions.test.tsx` asserts each pair emits the same `data-nb-part`
 * names and the same visible text in the same order.
 */
export const REPRODUCTIONS: {
  name: string
  recipe: SectionRecipe
  content: RecipeContent
  original: () => ReactElement
  /** Resolved Media docs for any `media` atom's slot id, keyed by `String(id)` (Task 3). */
  media?: Map<string, RecipeMediaDoc>
}[] = [
  {
    // src/blocks/Testimonials/config.ts: heading + items[{quote, author, role}].
    // Component.tsx order per item: item-body (quote) then item-heading
    // (author). `role` is a plain <p> with no data-nb-part, so it has no
    // template entry — there is nothing for a recipe to reproduce.
    name: 'Testimonials',
    recipe: {
      version: 1,
      // BLOCK_DEFAULT_SCHEME (src/blocks/lib/colorScheme.ts) puts testimonials
      // on 'muted', not 'default' — the equivalence suite never compares the
      // section root, so a wrong scheme here passed silently (task-1 review
      // finding 8).
      container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'center' },
      header: { heading: { name: 'heading', label: 'Heading' } },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
        template: [
          { kind: 'text', size: 'md', slot: { name: 'quote', label: 'Quote' } },
          { kind: 'heading', level: 3, size: 'sm', slot: { name: 'author', label: 'Author' } },
        ],
      },
    },
    content: {
      header: { heading: 'Section heading' },
      items: [{ quote: 'Q', author: 'A' }],
    },
    original: () => (
      <TestimonialsComponent
        block={{ heading: 'Section heading', items: [{ id: 't1', author: 'A', quote: 'Q' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // src/blocks/FeatureGrid/config.ts: heading + items[{icon, heading, text}].
    // The fixture leaves `variant` unset, which defaults to 'iconTop'
    // (Component.tsx: `variant ?? 'iconTop'`), so the icon renders; JSX order
    // per item is icon, then heading, then text.
    name: 'FeatureGrid',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
      header: { heading: { name: 'heading', label: 'Heading' } },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
        template: [
          { kind: 'icon', slot: { name: 'icon', label: 'Icon' } },
          { kind: 'heading', level: 3, size: 'sm', slot: { name: 'heading', label: 'Heading' } },
          { kind: 'text', size: 'sm', slot: { name: 'text', label: 'Text' } },
        ],
      },
    },
    content: {
      header: { heading: 'Section heading' },
      items: [{ icon: 'star', heading: 'One', text: 'T' }],
    },
    original: () => (
      <FeatureGridComponent
        block={{ heading: 'Section heading', items: [{ id: 'f1', icon: 'star', heading: 'One', text: 'T' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // src/blocks/Incentives/config.ts: heading + items[{icon, heading, text}]
    // — the same item shape as FeatureGrid, but a different block (a trust-
    // badge strip, not a feature showcase). Reusing the identical template
    // here is the point: it is what "the recipe generalises" means.
    //
    // `icon: 'lock'` (not 'star') on purpose: 'lock' is a real
    // INCENTIVE_ICONS key with no FEATURE_ICONS counterpart, so this
    // reproduction actually exercises RECIPE_ICONS's Incentives half instead
    // of both sides silently falling back to the same default glyph.
    name: 'Incentives',
    recipe: {
      version: 1,
      // BLOCK_DEFAULT_SCHEME puts incentives on 'muted' too (see the same
      // note on Testimonials above).
      container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'start' },
      header: { heading: { name: 'heading', label: 'Heading' } },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 4 }, gap: 'normal' },
        template: [
          { kind: 'icon', slot: { name: 'icon', label: 'Icon' } },
          { kind: 'heading', level: 3, size: 'sm', slot: { name: 'heading', label: 'Heading' } },
          { kind: 'text', size: 'sm', slot: { name: 'text', label: 'Text' } },
        ],
      },
    },
    content: {
      header: { heading: 'Section heading' },
      items: [{ icon: 'lock', heading: 'Item', text: 'T' }],
    },
    original: () => (
      <IncentivesComponent
        block={{ heading: 'Section heading', items: [{ id: 'i1', icon: 'lock', heading: 'Item', text: 'T' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // src/blocks/Steps/config.ts: heading + numbered (default true) +
    // steps[{title, description}]. The fixture leaves `variant` unset, which
    // falls through Component.tsx's switch to the horizontal/default case:
    // badge, then item-heading (title), then item-body (description).
    name: 'Steps',
    recipe: {
      version: 1,
      container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
      header: { heading: { name: 'heading', label: 'Heading' } },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'roomy' },
        template: [
          { kind: 'badge', source: 'index' },
          { kind: 'heading', level: 3, size: 'sm', slot: { name: 'title', label: 'Title' } },
          { kind: 'text', size: 'sm', slot: { name: 'description', label: 'Description' } },
        ],
      },
    },
    content: {
      header: { heading: 'Section heading' },
      items: [{ title: 'One', description: 'T' }],
    },
    original: () => (
      <StepsComponent
        block={{ heading: 'Section heading', steps: [{ id: 's1', title: 'One', description: 'T' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
  {
    // src/blocks/ImageGallery/config.ts: images + columns. There is no
    // heading field at all, so this recipe has no `header` — "media atom, no
    // header" from the brief's table. `src` now holds a Media document id
    // (Task 3), resolved through `media` against the same fixture doc the
    // original block renders, so both sides emit the same `<img>` src.
    name: 'ImageGallery',
    recipe: {
      version: 1,
      container: { width: 'full', padding: 'tight', scheme: 'default', align: 'start' },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 2, tablet: 3, desktop: 3 }, gap: 'tight' },
        template: [{ kind: 'media', aspect: '1:1', fit: 'cover', slot: { name: 'src', label: 'Image' } }],
      },
    },
    content: {
      items: [{ src: 1 }],
    },
    media: new Map([['1', { id: 1, url: '/gallery.png', alt: 'Fixture image' }]]),
    original: () => (
      <ImageGalleryComponent
        block={{ images: [{ id: 1, url: '/gallery.png', alt: 'Fixture image' }] } as never}
        ctx={fixtureCtx}
      />
    ),
  },
]
