import { describe, expect, it } from 'vitest'
import { PART_FIELD_CANDIDATES, blockRowPath, fieldPath, resolveEditField } from './edit-target'

describe('resolveEditField', () => {
  it('maps a heading part to the heading field', () => {
    expect(resolveEditField('heading', 'Fresh bread', { heading: 'Fresh bread' })).toBe('heading')
  })

  it('maps the body part to subheading — the part vocabulary and the field names differ', () => {
    expect(resolveEditField('body', 'Baked daily', { subheading: 'Baked daily' })).toBe('subheading')
  })

  // CTABanner, PromoSection and StoryStats name that field `body`, and render
  // it as `data-nb-part="body"` exactly as the Heroes render their `subheading`.
  it('maps the body part to a `body` field too, for the blocks that name it that', () => {
    expect(resolveEditField('body', 'Half price today', { body: 'Half price today' })).toBe('body')
  })

  it('refuses when both body candidates hold the clicked text', () => {
    const values = { subheading: 'Same words', body: 'Same words' }
    expect(resolveEditField('body', 'Same words', values)).toBeNull()
  })

  it('picks the CTA label whose value matches the clicked text', () => {
    const values = { primaryCtaLabel: 'Order now', secondaryCtaLabel: 'See menu' }
    expect(resolveEditField('cta', 'See menu', values)).toBe('secondaryCtaLabel')
  })

  // The guard that makes this safe without touching block markup: if the text
  // on screen is not the field's current value, we are looking at the wrong
  // node (a variant branch, a truncation, an icon label) and must not write.
  it('refuses when no candidate field holds the clicked text', () => {
    expect(resolveEditField('heading', 'Something else', { heading: 'Fresh bread' })).toBeNull()
  })

  it('refuses when two candidates hold the same text, since the target is ambiguous', () => {
    const values = { primaryCtaLabel: 'Shop', secondaryCtaLabel: 'Shop' }
    expect(resolveEditField('cta', 'Shop', values)).toBeNull()
  })

  it('refuses an unknown part rather than guessing', () => {
    expect(resolveEditField('badge', 'New', { heading: 'New' })).toBeNull()
  })

  // Array-item text is explicitly out of scope for Round 2.
  it('refuses item-scoped parts', () => {
    for (const part of ['item', 'item-heading', 'item-body', 'item-media']) {
      expect(resolveEditField(part, 'x', { heading: 'x' })).toBeNull()
    }
  })

  it('ignores non-string field values', () => {
    expect(resolveEditField('heading', '2', { heading: 2 })).toBeNull()
  })

  it('trims, because the DOM reports whitespace the field value does not carry', () => {
    expect(resolveEditField('heading', '  Fresh bread \n', { heading: 'Fresh bread' })).toBe('heading')
  })

  it('declares no candidates for the parts Round 2 does not edit', () => {
    expect(PART_FIELD_CANDIDATES.media).toBeUndefined()
    expect(PART_FIELD_CANDIDATES['item-heading']).toBeUndefined()
  })
})

describe('fieldPath', () => {
  it('builds the form-state path for a block row field', () => {
    expect(fieldPath(2, 'heading')).toBe('layout.2.heading')
  })

  // The invariant the spec calls highest-consequence, expressed as an equation
  // rather than a comment: BlockContentEditor gives RenderFields a parentPath of
  // `layout.<idx>`, and RenderFields appends `.<name>`. If that ever stops
  // agreeing with fieldPath, the canvas would write to a second entry.
  it('equals the inspector parentPath convention plus the field name', () => {
    const idx = 7
    const inspectorParentPath = `layout.${idx}`
    expect(fieldPath(idx, 'primaryCtaLabel')).toBe(`${inspectorParentPath}.primaryCtaLabel`)
  })
})

describe('blockRowPath', () => {
  it('builds the form-state path for a layout row', () => {
    expect(blockRowPath(2)).toBe('layout.2')
  })

  // Ruling D. The two tests above compare `fieldPath` against a second,
  // independently-written copy of the same formula — which is exactly what a
  // drift test cannot do, since both copies would have to be edited by hand to
  // stay wrong together. `BlockContentEditor` now derives its `parentPath` from
  // `blockRowPath`, so this asserts the composition itself: there is one
  // spelling of the row path, and the field path is that spelling plus the
  // field name. Drift between the inspector and the canvas is then impossible
  // by construction rather than merely tested for.
  it('is the prefix fieldPath is built from, so the inspector and canvas cannot drift', () => {
    for (const n of [0, 1, 7, 42]) {
      for (const field of ['heading', 'eyebrow', 'subheading', 'primaryCtaLabel']) {
        expect(fieldPath(n, field)).toBe(`${blockRowPath(n)}.${field}`)
      }
    }
  })
})
