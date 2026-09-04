import { describe, it, expect } from 'vitest'
import { parseRecipe, RecipeError, MAX_RECIPE_BYTES } from './parse'

const minimal = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'start' },
}

describe('parseRecipe', () => {
  it('accepts a minimal recipe and returns it typed', () => {
    const r = parseRecipe(minimal)
    expect(r.container.width).toBe('wide')
    expect(r.items).toBeUndefined()
  })

  it('rejects an unknown version, so a future v2 cannot be misread as v1', () => {
    expect(() => parseRecipe({ ...minimal, version: 2 })).toThrow(RecipeError)
  })

  it('rejects an out-of-vocabulary container enum', () => {
    expect(() => parseRecipe({ ...minimal, container: { ...minimal.container, width: 'gigantic' } })).toThrow(RecipeError)
  })

  it('drops keys the vocabulary does not declare', () => {
    const r = parseRecipe({ ...minimal, container: { ...minimal.container, boxShadow: '0 0 9px red' } })
    expect('boxShadow' in r.container).toBe(false)
  })

  it('clamps column counts into range rather than rejecting', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 3 },
        layout: { pattern: 'grid', columns: { mobile: 0, tablet: 2, desktop: 99 }, gap: 'normal' },
        template: [{ kind: 'text', size: 'md', slot: { name: 'body', label: 'Body' } }],
      },
    })
    expect(r.items!.layout.columns.mobile).toBe(1)
    expect(r.items!.layout.columns.desktop).toBe(4)
  })

  it('drops an atom whose kind is not in the vocabulary, keeping the rest', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [
          { kind: 'iframe', src: 'https://evil.test' },
          { kind: 'text', size: 'md', slot: { name: 'body', label: 'Body' } },
        ],
      },
    })
    expect(r.items!.template).toHaveLength(1)
    expect(r.items!.template[0].kind).toBe('text')
  })

  it('rejects a template atom missing its required slot', () => {
    expect(() =>
      parseRecipe({
        ...minimal,
        items: {
          source: { kind: 'static', count: 1 },
          layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
          template: [{ kind: 'heading', level: 3, size: 'md' }],
        },
      }),
    ).toThrow(RecipeError)
  })

  it('requires a link to declare hrefSlot', () => {
    const recipe = {
      version: 1,
      container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [{ kind: 'link', slot: { name: 'label', label: 'L' } }],
      },
    }
    expect(() => parseRecipe(recipe)).toThrow(/hrefSlot/)
  })

  it('throws above the size cap', () => {
    const fat = { ...minimal, container: { ...minimal.container, align: 'start' }, pad: 'x'.repeat(MAX_RECIPE_BYTES) }
    expect(() => parseRecipe(fat)).toThrow(RecipeError)
  })

  it('rejects a non-object', () => {
    expect(() => parseRecipe('nope')).toThrow(RecipeError)
    expect(() => parseRecipe(null)).toThrow(RecipeError)
  })
})

// Regression guards for the seven branches the brief's tests did not pin down
// directly (task-1 review, finding 3). Each documents the throw/drop/clamp
// decision it locks in.
describe('parseRecipe — undocumented branches', () => {
  it('drops the whole items block when source.kind is not in vocabulary', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'product', count: 3 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [{ kind: 'text', size: 'md', slot: { name: 'body', label: 'Body' } }],
      },
    })
    expect(r.items).toBeUndefined()
  })

  it('drops the whole items block when layout.pattern is not in vocabulary', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'masonry', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [{ kind: 'text', size: 'md', slot: { name: 'body', label: 'Body' } }],
      },
    })
    expect(r.items).toBeUndefined()
  })

  it('drops the whole items block when layout.gap is not in vocabulary, same as an invalid pattern', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'cavernous' },
        template: [{ kind: 'text', size: 'md', slot: { name: 'body', label: 'Body' } }],
      },
    })
    expect(r.items).toBeUndefined()
  })

  it('drops an atom that is both out-of-vocabulary on an enum and missing its slot, without throwing', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [
          { kind: 'heading', level: 99, size: 'md' }, // invalid level AND no slot
          { kind: 'text', size: 'md', slot: { name: 'body', label: 'Body' } },
        ],
      },
    })
    expect(r.items!.template).toHaveLength(1)
    expect(r.items!.template[0].kind).toBe('text')
  })

  it('clamps source.count into 1-12, the authoring-form bound, rather than leaving it unbounded', () => {
    const low = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 0 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [],
      },
    })
    expect(low.items!.source.count).toBe(1)

    const high = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 99 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [],
      },
    })
    expect(high.items!.source.count).toBe(12)
  })

  it('drops a malformed header slot but keeps the others', () => {
    const r = parseRecipe({
      ...minimal,
      header: {
        eyebrow: { name: 'eyebrow', label: 'Eyebrow' },
        heading: { name: 'heading' }, // missing label — malformed
      },
    })
    expect(r.header!.eyebrow).toEqual({ name: 'eyebrow', label: 'Eyebrow' })
    expect('heading' in r.header!).toBe(false)
  })

  it('rejects a required slot whose name is empty or whitespace-only, same as a missing slot', () => {
    for (const name of ['', '   ']) {
      expect(() =>
        parseRecipe({
          ...minimal,
          items: {
            source: { kind: 'static', count: 1 },
            layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
            template: [{ kind: 'heading', level: 3, size: 'md', slot: { name, label: 'Body' } }],
          },
        }),
      ).toThrow(RecipeError)
    }
  })

  it('drops an optional badge slot with an empty name, keeping the badge index-only rather than persisting an unusable name', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [{ kind: 'badge', source: 'index', slot: { name: '', label: 'X' } }],
      },
    })
    expect(r.items!.template).toHaveLength(1)
    expect('slot' in r.items!.template[0]).toBe(false)
  })

  it('drops the whole items block when template is not an array', () => {
    const r = parseRecipe({
      ...minimal,
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: 'not-an-array',
      },
    })
    expect(r.items).toBeUndefined()
  })
})

describe('slot name grammar', () => {
  const withHeading = (name: string) => ({
    version: 1,
    container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
    header: { heading: { name, label: 'Title' } },
  })

  it('accepts a lowerCamelCase name', () => {
    expect(parseRecipe(withHeading('cardTitle')).header?.heading?.name).toBe('cardTitle')
  })

  it.each(['__proto__', 'Title', '1st', 'card-title', 'card title', ''])(
    'rejects %j',
    (name) => {
      // A malformed slot is dropped, and `heading` is an optional header slot,
      // so the recipe still parses — with no heading at all.
      expect(parseRecipe(withHeading(name)).header?.heading).toBeUndefined()
    },
  )

  // The grammar is an identifier rule, not a prototype blocklist. `__proto__` fails
  // it because it is not alphanumeric, which is a happy consequence rather than the
  // purpose. `constructor` and `toString` are ordinary identifiers and stay legal —
  // they are safe because `pick()` in src/lib/recipe-content.ts reads with
  // Object.hasOwn and writes with Object.defineProperty, so a slot named after a
  // prototype member becomes an ordinary own key. Do not add a reserved-word list
  // here: it would duplicate a defence that already exists, and word lists rot.
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'accepts %j — the grammar is an identifier rule, not a blocklist',
    (name) => {
      expect(parseRecipe(withHeading(name)).header?.heading?.name).toBe(name)
    },
  )
})

describe('slot name uniqueness', () => {
  const twoSlots = (a: string, b: string) => ({
    version: 1,
    container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
    header: { heading: { name: a, label: 'A' } },
    items: {
      source: { kind: 'static', count: 2 },
      layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 2 }, gap: 'normal' },
      template: [{ kind: 'text', size: 'md', slot: { name: b, label: 'B' } }],
    },
  })

  it('accepts distinct names', () => {
    expect(parseRecipe(twoSlots('title', 'body')).items?.template).toHaveLength(1)
  })

  it('rejects the same name declared twice across header and template', () => {
    expect(() => parseRecipe(twoSlots('title', 'title'))).toThrow(/declared more than once/)
  })

  it('rejects a duplicate within one template', () => {
    const recipe = twoSlots('title', 'body') as unknown as Record<string, never>
    ;(recipe.items as { template: unknown[] }).template.push({
      kind: 'heading', level: 3, size: 'md', slot: { name: 'body', label: 'Dup' },
    })
    expect(() => parseRecipe(recipe)).toThrow(/declared more than once/)
  })
})
