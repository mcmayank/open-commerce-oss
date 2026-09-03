import { describe, it, expect } from 'vitest'
import { PAGE_BLOCKS } from '@/blocks/registry'
import {
  contentFieldsFor,
  findBlockDefinitions,
  layoutFieldsFor,
  LAYOUT_FIELD_NAMES,
  DEDICATED_FIELD_NAMES,
} from './content-fields'

/** Shape `findBlockDefinitions` returns from the real `Pages` config — enough to drive both the field lookups and the declared-name walk below. */
type PageBlockDef = { slug: string; fields?: unknown[] }

/** The real `Pages.layout` blocks field, for tests that want to exercise the split against the actual collection rather than the standalone registry. */
async function pagesLayoutField() {
  const { Pages } = await import('@/collections/Pages')
  return Pages.fields
}

/** The field names a block declares at its top level, in declaration order. */
function declaredFieldNames(block: PageBlockDef): string[] {
  return (block.fields ?? [])
    .map((f) => (f && typeof f === 'object' && 'name' in f ? (f as { name?: string }).name : undefined))
    .filter((n): n is string => !!n)
}

/** The three fields the inspector renders its own dedicated control for — see BlockInspector. */
describe('DEDICATED_FIELD_NAMES', () => {
  it('is exactly the set BlockInspector renders its own controls for', () => {
    expect([...DEDICATED_FIELD_NAMES].sort()).toEqual(['blockStyle', 'scheme', 'variant'])
  })
})

describe('contentFieldsFor', () => {
  it("returns a hero's authorable content fields", () => {
    const names = contentFieldsFor(PAGE_BLOCKS, 'hero').map((f) => f.name)

    expect(names).toContain('heading')
    expect(names).toContain('subheading')
    expect(names).toContain('eyebrow')
    expect(names).toContain('primaryCtaLabel')
    expect(names).toContain('media')
  })

  it('excludes the fields that already have their own dedicated control, so no control appears twice', () => {
    const names = contentFieldsFor(PAGE_BLOCKS, 'hero').map((f) => f.name)

    expect(names).not.toContain('variant')
    expect(names).not.toContain('scheme')
    expect(names).not.toContain('blockStyle')
  })

  it('preserves the order the block declares its fields in', () => {
    const names = contentFieldsFor(PAGE_BLOCKS, 'hero').map((f) => f.name)
    expect(names.indexOf('eyebrow')).toBeLessThan(names.indexOf('heading'))
    expect(names.indexOf('heading')).toBeLessThan(names.indexOf('subheading'))
  })

  it('returns an empty list for an unknown block type rather than throwing', () => {
    expect(contentFieldsFor(PAGE_BLOCKS, 'notARealBlock')).toEqual([])
    expect(contentFieldsFor(PAGE_BLOCKS, undefined)).toEqual([])
  })

  it('leaves every registered block with at least one content field, or none at all if it has no content', () => {
    // A block whose ONLY fields are dedicated/layout fields would render an
    // empty Content tab — that is fine, but a block losing all its content
    // fields by accident is not. Spacer is the one legitimately content-free
    // block.
    for (const block of PAGE_BLOCKS) {
      const fields = contentFieldsFor(PAGE_BLOCKS, block.slug)
      if (block.slug === 'spacer') continue
      expect(fields.length, `${block.slug} has no content fields`).toBeGreaterThan(0)
    }
  })

  it('never returns a field with its own dedicated control, for any registered block', () => {
    for (const block of PAGE_BLOCKS) {
      for (const field of contentFieldsFor(PAGE_BLOCKS, block.slug)) {
        expect(DEDICATED_FIELD_NAMES).not.toContain(field.name)
      }
    }
  })
})

describe('findBlockDefinitions', () => {
  it('finds the layout blocks field through the real Pages tab structure', async () => {
    // Against the REAL collection, not a fixture: `layout` sits inside an
    // unnamed `tabs` field, and `config.blocks` is not set at the root, so
    // `config.blocksMap` is empty at runtime. If someone restructures the
    // Content tab, this fails rather than the Content tab silently emptying.
    const { Pages } = await import('@/collections/Pages')
    const blocks = findBlockDefinitions(Pages.fields, 'layout')

    expect(blocks.length).toBe(PAGE_BLOCKS.length)
    expect(blocks.map((b) => b.slug)).toContain('hero')
    expect(blocks.map((b) => b.slug)).toContain('customSection')
  })

  it('returns an empty list when no such blocks field exists', () => {
    expect(findBlockDefinitions([{ name: 'title', type: 'text' }], 'layout')).toEqual([])
    expect(findBlockDefinitions([], 'layout')).toEqual([])
  })

  it('descends through rows, groups and collapsibles as well as tabs', () => {
    const nested = [
      {
        type: 'collapsible',
        fields: [{ type: 'row', fields: [{ name: 'layout', type: 'blocks', blocks: [{ slug: 'hero' }] }] }],
      },
    ]
    expect(findBlockDefinitions(nested, 'layout').map((b) => b.slug)).toEqual(['hero'])
  })
})

describe('layoutFieldsFor', () => {
  it('names the layout knobs that belong on the Layout tab', () => {
    expect([...LAYOUT_FIELD_NAMES].sort()).toEqual([
      'mediaSide',
      'minHeight',
      'overlay',
      'textAlign',
      'verticalAlign',
    ])
  })

  it("returns a hero's layout fields in declaration order", () => {
    const names = layoutFieldsFor(PAGE_BLOCKS, 'hero').map((f) => f.name)
    expect(names).toEqual(['mediaSide', 'textAlign', 'verticalAlign', 'overlay', 'minHeight'])
  })

  it('keeps layout fields OUT of the content tab', () => {
    // The original flaw: the split was defined by what the Style tab happened
    // to implement, so height and alignment landed among the text fields.
    const content = contentFieldsFor(PAGE_BLOCKS, 'hero').map((f) => f.name)
    for (const name of LAYOUT_FIELD_NAMES) expect(content).not.toContain(name)
  })

  it('still leaves the words, media and links on the content tab', () => {
    const content = contentFieldsFor(PAGE_BLOCKS, 'hero').map((f) => f.name)
    expect(content).toContain('heading')
    expect(content).toContain('subheading')
    expect(content).toContain('media')
    expect(content).toContain('primaryCtaLabel')
  })

  it('every declared field lands on exactly one of the three tabs, for every block in the registry', async () => {
    // Against the REAL Pages config (via findBlockDefinitions), not the
    // standalone PAGE_BLOCKS import — same discipline as the
    // `findBlockDefinitions` describe block above: if someone restructures
    // how blocks are declared, this fails rather than the split silently
    // going stale.
    const blocks = findBlockDefinitions<PageBlockDef>(await pagesLayoutField(), 'layout')
    expect(blocks.length).toBeGreaterThan(0) // presence guard

    for (const block of blocks) {
      const content = contentFieldsFor(blocks, block.slug).map((f) => f.name)
      const layout = layoutFieldsFor(blocks, block.slug).map((f) => f.name)
      const dedicated = [...DEDICATED_FIELD_NAMES]

      const all = [...content, ...layout, ...dedicated]
      const named = declaredFieldNames(block)

      // No field appears twice across the three tabs.
      expect(new Set(all).size, `${block.slug} has a field on two tabs`).toBe(all.length)
      // No declared field is missing from all three.
      for (const name of named) {
        expect(all, `${block.slug}.${name} appears on no tab`).toContain(name)
      }
    }
  })

  it('returns an empty list for a block with no layout knobs', () => {
    expect(layoutFieldsFor(PAGE_BLOCKS, 'richText')).toEqual([])
    expect(layoutFieldsFor(PAGE_BLOCKS, 'notARealBlock')).toEqual([])
  })
})

describe('the field types whose hydration was the open question', () => {
  it('gives customSection a Content tab of exactly definition + content', () => {
    // `scheme` has its own dedicated control on the Style tab, so the Content
    // tab is the relationship picker plus the recipe editor — nothing else.
    const names = contentFieldsFor(PAGE_BLOCKS, 'customSection').map((f) => f.name)
    expect(names).toEqual(['definition', 'content'])
  })

  it('routes customSection.content through RecipeContentField', () => {
    // This is the custom field component whose server-side rendering under
    // PageBuilderView's `renderAllFields: false` was the open risk. If the
    // component declaration ever moves, the Content tab silently renders a raw
    // JSON textarea instead of the recipe form.
    const field = contentFieldsFor<{
      name?: string
      admin?: { components?: { Field?: string } }
    }>(PAGE_BLOCKS, 'customSection').find((f) => f.name === 'content')

    expect(field?.admin?.components?.Field).toBe('@/components/admin/RecipeContentField')
  })

  it("keeps Hero's upload fields on the Content tab", () => {
    const fields = contentFieldsFor<{ name?: string; type?: string; relationTo?: string }>(
      PAGE_BLOCKS,
      'hero',
    )
    const uploads = fields.filter((f) => f.type === 'upload')
    expect(uploads.map((f) => f.name).sort()).toEqual(['backgroundImage', 'media', 'poster'])
    for (const u of uploads) expect(u.relationTo).toBe('media')
  })

  it('every custom Field component reachable from a Content tab is a real path', () => {
    // A stale component path fails at render time in the admin, not at build.
    for (const block of PAGE_BLOCKS) {
      const fields = contentFieldsFor<{
        name?: string
        admin?: { components?: { Field?: string } }
      }>(PAGE_BLOCKS, block.slug)
      for (const f of fields) {
        const path = f.admin?.components?.Field
        if (path) expect(path.startsWith('@/components/admin/')).toBe(true)
      }
    }
  })
})

