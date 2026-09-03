import { describe, expect, it } from 'vitest'
import { buildDefaultHomeLayout, isUntouchedDefaultHome } from './default-home'
import { Hero } from '@/blocks/Hero/config'

/**
 * Read the schema default straight off the block config rather than repeating
 * the literal. This test previously hardcoded `minHeight: 'lg'`; when the Hero
 * gained real height options and its default moved to 'auto', the fixture no
 * longer described a block "carrying only schema defaults" and the test failed
 * for a reason that had nothing to do with the code under test.
 */
function heroDefault(name: string): unknown {
  const field = Hero.fields.find((f) => 'name' in f && f.name === name) as
    | { defaultValue?: unknown }
    | undefined
  return field?.defaultValue
}

/**
 * What Payload actually hands back for a freshly provisioned home page, copied
 * verbatim from a round-trip against the local dev database. This shape is the
 * whole reason a naive deep-equal against `buildDefaultHomeLayout` is wrong:
 * generated `id`s, `blockName: null`, every unset optional materialised as null
 * or `[]`, and a different key order.
 *
 * If this drifts from what Payload stores, `isUntouchedDefaultHome` starts
 * reporting every page as edited and no pack homepage ever installs again —
 * which is exactly what the first test below would catch.
 */
const STORED_DEFAULT = [
  {
    id: '6a66e7fb10817a1e90c59937',
    heading: 'Probe Store',
    subheading: 'Welcome — take a look around and find something you love.',
    backgroundImage: null,
    ctaLabel: 'Shop now',
    ctaHref: '/products',
    blockName: null,
    blockType: 'hero',
    variant: 'centered',
  },
  {
    id: '6a66e7fb10817a1e90c59938',
    variant: 'grid',
    columns: '4',
    eyebrow: null,
    heading: 'Featured products',
    source: 'latest',
    category: null,
    limit: 8,
    blockName: null,
    blockType: 'productGrid',
    products: [],
  },
  {
    id: '6a66e7fb10817a1e90c5993c',
    heading: null,
    columns: '3',
    blockName: null,
    items: [
      { id: 'a1', icon: 'truck', heading: 'Fast delivery', text: 'Quick, reliable shipping on every order.' },
      { id: 'a2', icon: 'returns', heading: 'Easy returns', text: 'Changed your mind? Returns are simple.' },
      { id: 'a3', icon: 'lock', heading: 'Secure checkout', text: 'Your payment details are always protected.' },
    ],
    blockType: 'incentives',
  },
]

function edited(mutate: (layout: typeof STORED_DEFAULT) => void) {
  const copy = structuredClone(STORED_DEFAULT)
  mutate(copy)
  return copy
}

describe('isUntouchedDefaultHome', () => {
  /**
   * REGRESSION. Payload materialises every field's `defaultValue` on save, so a
   * block gains keys the moment its schema does. The unified-Hero work added
   * five non-null defaults, and every freshly provisioned homepage began
   * reading as EDITED — which made `seedSampleCatalogue` silently skip
   * installing the pack homepage for every tenant.
   *
   * The five below are the exact fields that broke it.
   */
  it('treats a stored block carrying only schema defaults as untouched', () => {
    const stored = buildDefaultHomeLayout('Acme').map((block, i) =>
      i === 0
        ? {
            ...block,
            id: '6a83ce6e51a4994cee4a7e74',
            blockName: null,
            mediaSide: 'right',
            textAlign: 'center',
            verticalAlign: 'middle',
            overlay: 'medium',
            minHeight: heroDefault('minHeight'),
          }
        : block,
    )
    expect(isUntouchedDefaultHome(stored, 'Acme')).toBe(true)
  })

  it('still detects an edit that moves a field OFF its default', () => {
    // The safety property: dropping at-default fields must not blind the check
    // to a real change, because a false "untouched" overwrites merchant work.
    const edited = buildDefaultHomeLayout('Acme').map((block, i) =>
      i === 0 ? { ...block, overlay: 'heavy' } : block,
    )
    expect(isUntouchedDefaultHome(edited, 'Acme')).toBe(false)
  })

  it('recognises a provisioned page that has been through Payload untouched', () => {
    expect(isUntouchedDefaultHome(STORED_DEFAULT, 'Probe Store')).toBe(true)
  })

  it('recognises the freshly built layout, before any save', () => {
    expect(isUntouchedDefaultHome(buildDefaultHomeLayout('Probe Store'), 'Probe Store')).toBe(true)
  })

  it('does not mistake a renamed store for an edit', () => {
    // Renaming the store does not rewrite its pages, so the heading still says
    // the old name. Treating that as an edit would mean a pack homepage never
    // installs for any store that has ever been renamed.
    expect(isUntouchedDefaultHome(STORED_DEFAULT, 'Renamed Since')).toBe(true)
  })

  it('detects a removed block', () => {
    expect(isUntouchedDefaultHome(edited((l) => void l.pop()), 'Probe Store')).toBe(false)
  })

  it('detects an added block', () => {
    const l = edited((l) => void l.push({ ...STORED_DEFAULT[0], id: 'x' }))
    expect(isUntouchedDefaultHome(l, 'Probe Store')).toBe(false)
  })

  it('detects reordered blocks', () => {
    expect(isUntouchedDefaultHome(edited((l) => l.reverse()), 'Probe Store')).toBe(false)
  })

  // The case a blockType-sequence comparison would miss: same blocks, merchant
  // rewrote the copy. Losing that to a seed is the whole point of this check.
  it('detects an edited subheading', () => {
    const l = edited((l) => {
      l[0].subheading = 'Our own words.'
    })
    expect(isUntouchedDefaultHome(l, 'Probe Store')).toBe(false)
  })

  it('detects an edited nested array row', () => {
    const l = edited((l) => {
      l[2].items![1].text = 'Returns within 14 days.'
    })
    expect(isUntouchedDefaultHome(l, 'Probe Store')).toBe(false)
  })

  it('detects a filled-in optional field', () => {
    // Cast because the literal above infers `eyebrow: null` — which is exactly
    // the shape Payload stores for an optional field the merchant left blank.
    const l = edited((l) => {
      ;(l[1] as { eyebrow: string | null }).eyebrow = 'Just in'
    })
    expect(isUntouchedDefaultHome(l, 'Probe Store')).toBe(false)
  })

  it('detects a changed scalar of the same shape', () => {
    const l = edited((l) => {
      l[1].limit = 4
    })
    expect(isUntouchedDefaultHome(l, 'Probe Store')).toBe(false)
  })

  it('treats an empty or missing layout as edited, never as the default', () => {
    // A `home` page with no blocks is not the layout provisionHomePage wrote, so
    // it is not ours to overwrite.
    expect(isUntouchedDefaultHome([], 'Probe Store')).toBe(false)
    expect(isUntouchedDefaultHome(null, 'Probe Store')).toBe(false)
    expect(isUntouchedDefaultHome(undefined, 'Probe Store')).toBe(false)
  })
})
