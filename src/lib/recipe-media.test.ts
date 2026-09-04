import { vi, describe, expect, it } from 'vitest'
import { collectMediaIds, resolveRecipeMedia } from './recipe-media'
import type { SectionRecipe } from '@/blocks/recipe/types'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

const recipe: SectionRecipe = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'default', align: 'center' },
  items: {
    source: { kind: 'static', count: 3 },
    layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
    template: [
      { kind: 'media', aspect: '4:5', fit: 'cover', slot: { name: 'image', label: 'Image' } },
      { kind: 'heading', level: 3, size: 'md', slot: { name: 'title', label: 'Title' } },
    ],
  },
}

describe('collectMediaIds', () => {
  it('collects ids from media slots only, deduped', () => {
    const ids = collectMediaIds(recipe, {
      header: {},
      items: [{ image: 7, title: 'A' }, { image: 7, title: 'B' }, { image: 9, title: 'C' }],
    })
    expect(ids).toEqual(['7', '9'])
  })

  it('ignores empty and missing values', () => {
    expect(collectMediaIds(recipe, { header: {}, items: [{ title: 'A' }, { image: '' }] })).toEqual([])
  })

  it('returns nothing when the recipe declares no media atom', () => {
    const textOnly: SectionRecipe = { ...recipe, items: { ...recipe.items!, template: [recipe.items!.template[1]] } }
    expect(collectMediaIds(textOnly, { header: {}, items: [{ image: 7 }] })).toEqual([])
  })

  /**
   * `media.id` is a Postgres integer column. A slot value that is not a whole
   * number reaches `where: { id: { in: [...] } }` as-is and raises `22P02
   * invalid input syntax for type integer` — and because the caller's catch
   * replaces the entire media map, ONE bad value blanks every image in the
   * section. A URL string is the likeliest shape to arrive here: `content` is
   * an opaque `json` field as far as `list_blocks` is concerned.
   */
  describe('rejects anything that is not a whole-number id', () => {
    it.each([
      ['a URL string', 'https://cdn.example/photo.jpg'],
      ['a non-numeric string', 'hat.jpg'],
      ['an array', [7, 9]],
      ['an object', { id: 7 }],
      ['a boolean', true],
      ['a float', 7.5],
      ['a numeric string with a decimal point', '7.5'],
    ])('skips %s', (_label, value) => {
      expect(collectMediaIds(recipe, { header: {}, items: [{ image: value }] })).toEqual([])
    })

    it('still collects the good ids around a bad one, rather than bailing out', () => {
      // The failure this guards is not "the bad value is dropped" but "the bad
      // value does not take the section's other images down with it".
      const ids = collectMediaIds(recipe, {
        header: {},
        items: [{ image: 7 }, { image: 'https://cdn.example/photo.jpg' }, { image: '9' }],
      })
      expect(ids).toEqual(['7', '9'])
    })

    it('accepts a numeric string and a number alike, deduping across both forms', () => {
      // Guard against over-tightening the filter into "numbers only": a slot
      // written through the admin form stores a STRING id (RecipeContentField
      // coerces every slot value to a string), so rejecting those would drop
      // every image a merchant picked by hand.
      expect(collectMediaIds(recipe, { header: {}, items: [{ image: '7' }, { image: 7 }] })).toEqual(['7'])
    })
  })
})

describe('resolveRecipeMedia', () => {
  const payloadWith = (docs: unknown[]) => {
    const calls: { where?: unknown; limit?: number }[] = []
    return {
      calls,
      payload: {
        find: async (args: { where?: unknown; limit?: number }) => {
          calls.push(args)
          return { docs }
        },
      } as unknown as Parameters<typeof resolveRecipeMedia>[0],
    }
  }

  it('issues ONE query for many ids and keys the map by string', async () => {
    const { calls, payload } = payloadWith([{ id: 7, url: '/a.jpg', alt: 'a' }, { id: 9, url: '/b.jpg', alt: 'b' }])
    const map = await resolveRecipeMedia(payload, 1, ['7', '9'])
    expect(calls).toHaveLength(1)
    expect(map.get('7')?.url).toBe('/a.jpg')
    expect(map.get('9')?.url).toBe('/b.jpg')
  })

  it('does not query at all for an empty id list', async () => {
    const { calls, payload } = payloadWith([])
    const map = await resolveRecipeMedia(payload, 1, [])
    expect(calls).toHaveLength(0)
    expect(map.size).toBe(0)
  })

  it('omits an id the query did not return rather than inventing an entry', async () => {
    const { payload } = payloadWith([{ id: 7, url: '/a.jpg', alt: 'a' }])
    const map = await resolveRecipeMedia(payload, 1, ['7', '9'])
    expect(map.has('7')).toBe(true)
    expect(map.has('9')).toBe(false)
  })
})

describe('resolveRecipeMedia — tenant scoping', () => {
  /**
   * Unlike `payloadWith` above, this stub actually applies the `where`
   * clause it receives — filtering `docs` by the `tenant.equals` and
   * `id.in` predicates the way Postgres would — so this test proves the
   * query is scoped, not just that a scoped-looking object was passed.
   */
  const tenantAwarePayload = (docs: { id: number; url: string; alt: string; tenant: number }[]) => {
    const calls: { where?: unknown; limit?: number; depth?: number }[] = []
    return {
      calls,
      payload: {
        find: async (args: { where?: unknown; limit?: number; depth?: number }) => {
          calls.push(args)
          const clauses = (args.where as { and?: Array<Record<string, { equals?: unknown; in?: string[] }>> })
            ?.and ?? []
          const tenantEquals = clauses.find((c) => 'tenant' in c)?.tenant?.equals
          const idIn = clauses.find((c) => 'id' in c)?.id?.in
          const filtered = docs.filter(
            (d) =>
              (tenantEquals === undefined || d.tenant === tenantEquals) &&
              (idIn === undefined || idIn.includes(String(d.id))),
          )
          return { docs: filtered }
        },
      } as unknown as Parameters<typeof resolveRecipeMedia>[0],
    }
  }

  it('carries an explicit tenant predicate alongside the id filter', async () => {
    const { calls, payload } = tenantAwarePayload([{ id: 7, url: '/a.jpg', alt: 'a', tenant: 1 }])
    await resolveRecipeMedia(payload, 1, ['7'])
    expect(calls[0].where).toEqual({ and: [{ tenant: { equals: 1 } }, { id: { in: ['7'] } }] })
    // Guards against a regression silently populating relations (dropping
    // `depth: 0`) or truncating a large section (hardcoding a small `limit`
    // instead of sizing it to the id count) — neither would be caught by the
    // `where` assertion above alone.
    expect(calls[0].depth).toBe(0)
    expect(calls[0].limit).toBe(1)
  })

  it('does not resolve a media id belonging to another tenant', async () => {
    const { payload } = tenantAwarePayload([
      { id: 7, url: '/mine.jpg', alt: 'mine', tenant: 1 },
      { id: 9, url: '/theirs.jpg', alt: 'theirs', tenant: 2 },
    ])
    // Tenant 1's recipe content names id 9 too (unvalidated merchant JSON can
    // name any id) — id 9 belongs to tenant 2 and must not resolve for tenant 1.
    const map = await resolveRecipeMedia(payload, 1, ['7', '9'])
    expect(map.has('7')).toBe(true)
    expect(map.has('9')).toBe(false)
  })
})
