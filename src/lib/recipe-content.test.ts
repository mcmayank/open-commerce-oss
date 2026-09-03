import { describe, expect, it } from 'vitest'
import { cleanRecipeContent } from './recipe-content'
import type { SectionRecipe } from '@/blocks/recipe/types'

const recipe: SectionRecipe = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
  header: { heading: { name: 'title', label: 'Title' } },
  items: {
    source: { kind: 'static', count: 3 },
    layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
    template: [
      { kind: 'heading', level: 3, size: 'md', slot: { name: 'name', label: 'Name' } },
      { kind: 'badge', source: 'index' }, // no slot — must not contribute a name
    ],
  },
}

describe('cleanRecipeContent', () => {
  it('keeps slots the recipe declares', () => {
    const out = cleanRecipeContent(recipe, { header: { title: 'Hello' }, items: [{ name: 'One' }] })
    expect(out.header).toEqual({ title: 'Hello' })
    expect(out.items).toEqual([{ name: 'One' }])
  })

  it('drops slots the recipe does not declare', () => {
    const out = cleanRecipeContent(recipe, {
      header: { title: 'Hello', subtitle: 'Dropped' },
      items: [{ name: 'One', price: 'Dropped' }],
    })
    expect(out.header).toEqual({ title: 'Hello' })
    expect(out.items).toEqual([{ name: 'One' }])
  })

  it('does not mutate the stored row — dropping happens at read only', () => {
    const stored = { header: { title: 'Hello', subtitle: 'Keep me on disk' }, items: [] }
    cleanRecipeContent(recipe, stored)
    expect(stored.header.subtitle).toBe('Keep me on disk')
  })

  it('survives content that is not the expected shape', () => {
    expect(cleanRecipeContent(recipe, null)).toEqual({ header: {}, items: [] })
    expect(cleanRecipeContent(recipe, 'nonsense')).toEqual({ header: {}, items: [] })
    expect(cleanRecipeContent(recipe, { items: 'not an array' })).toEqual({ header: {}, items: [] })
    expect(cleanRecipeContent(recipe, { items: [null, 7] })).toEqual({ header: {}, items: [{}, {}] })
  })

  it('survives additional malformed input shapes', () => {
    // raw is a bare array
    expect(cleanRecipeContent(recipe, [])).toEqual({ header: {}, items: [] })
    // raw is a number
    expect(cleanRecipeContent(recipe, 42)).toEqual({ header: {}, items: [] })
    // content.header is an array
    expect(cleanRecipeContent(recipe, { header: ['not', 'an', 'object'] })).toEqual({
      header: {},
      items: [],
    })
    // content.items entry is an array
    expect(cleanRecipeContent(recipe, { items: [['array', 'not', 'object']] })).toEqual({
      header: {},
      items: [{}],
    })
  })

  it('does not copy inherited keys from Object.prototype', () => {
    // Create a recipe with slots named after Object.prototype members
    const prototypeRecipe: SectionRecipe = {
      version: 1,
      container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
      header: { heading: { name: 'constructor', label: 'Constructor' } },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [{ kind: 'text', size: 'md', slot: { name: 'toString', label: 'ToString' } }],
      },
    }

    // Content that does NOT supply these slots — inherited members should not leak in
    const out = cleanRecipeContent(prototypeRecipe, { header: {}, items: [{}] })

    // The cleaned content must not include inherited properties
    expect(out.header).toEqual({})
    expect(Object.hasOwn(out.header, 'constructor')).toBe(false)
    expect(out.items).toEqual([{}])
    expect(Object.hasOwn(out.items[0], 'toString')).toBe(false)
  })

  it('drops __proto__ from content when the recipe does not declare it', () => {
    const hostile = JSON.parse('{"header": {"__proto__": {"polluted": true}}, "items": []}')
    const out = cleanRecipeContent(recipe, hostile)
    expect(out.header).toEqual({})
    expect(Object.getPrototypeOf(out.header)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rejects __proto__ pollution even when it WAS in the declared recipe', () => {
    // The reachable case, and the one the old version of this test only claimed
    // to cover: parseSlot accepts any non-empty string, so a recipe declaring a
    // slot named `__proto__` is valid and storable. `__proto__` is then in the
    // allowed set, so the name really is copied — and a plain `out[name] = …`
    // would hit Object.prototype's setter and re-point the returned object's
    // prototype at merchant-controlled data rather than defining an own key.
    const protoRecipe: SectionRecipe = {
      version: 1,
      container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
      header: { heading: { name: '__proto__', label: 'Hostile' } },
      items: {
        source: { kind: 'static', count: 1 },
        layout: { pattern: 'grid', columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'normal' },
        template: [{ kind: 'text', size: 'md', slot: { name: '__proto__', label: 'Hostile' } }],
      },
    }
    const hostile = JSON.parse(
      '{"header": {"__proto__": {"polluted": true}}, "items": [{"__proto__": {"polluted": true}}]}',
    )
    const out = cleanRecipeContent(protoRecipe, hostile)

    // The prototype of the returned objects is untouched...
    expect(Object.getPrototypeOf(out.header)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(out.items[0])).toBe(Object.prototype)
    // ...so the attacker's key is not readable as an inherited property.
    expect((out.header as Record<string, unknown>).polluted).toBeUndefined()
    expect((out.items[0] as Record<string, unknown>).polluted).toBeUndefined()
    // The declared slot is carried as a real OWN property, not a prototype swap.
    expect(Object.hasOwn(out.header, '__proto__')).toBe(true)
    expect(Object.hasOwn(out.items[0], '__proto__')).toBe(true)
    // And nothing leaked onto Object.prototype itself.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('returns no items at all when the recipe declares none', () => {
    // A recipe with no `items` declares no item slots, so every entry would clean
    // to `{}` and RecipeSection renders none of them either way. Returning them
    // as empty objects was pure allocation, and unbounded — the same exposure the
    // slice below closes.
    const headerOnly: SectionRecipe = { ...recipe, items: undefined }
    const out = cleanRecipeContent(headerOnly, { header: { title: 'Hi' }, items: [{ name: 'x' }] })
    expect(out.header).toEqual({ title: 'Hi' })
    expect(out.items).toEqual([])
  })

  /**
   * `content` carries no write-boundary cap and deliberately never will: dropping
   * at read is what lets a merchant's copy survive a slot being removed and
   * re-added. So the bound has to live here, before the map — one authenticated
   * PATCH can store 200,000 items, and mapping them all just to have
   * RecipeSection slice to `source.count` is unbounded work on every render.
   */
  describe('bounds stored items by the recipe’s declared count', () => {
    it('returns only `source.count` items when content carries more', () => {
      const stored = { header: {}, items: Array.from({ length: 500 }, (_, i) => ({ name: `#${i}` })) }
      const out = cleanRecipeContent(recipe, stored)
      expect(recipe.items?.source.count).toBe(3)
      expect(out.items).toHaveLength(3)
      // Sliced from the front, so the merchant sees the items they authored first.
      expect(out.items).toEqual([{ name: '#0' }, { name: '#1' }, { name: '#2' }])
    })

    it('does not mutate the stored row while bounding it', () => {
      const stored = { header: {}, items: Array.from({ length: 50 }, (_, i) => ({ name: `#${i}` })) }
      cleanRecipeContent(recipe, stored)
      expect(stored.items).toHaveLength(50)
      expect(stored.items[49]).toEqual({ name: '#49' })
    })

    it('keeps every item when content carries fewer than the declared count', () => {
      const out = cleanRecipeContent(recipe, { header: {}, items: [{ name: 'One' }] })
      expect(out.items).toEqual([{ name: 'One' }])
    })
  })
})
