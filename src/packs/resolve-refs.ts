import type { PackBlock } from './types'

export type RefMaps = {
  products: Map<string, number>
  categories: Map<string, number>
  media: Map<string, number>
}

const KINDS = ['$product', '$category', '$media'] as const
type Kind = (typeof KINDS)[number]

const MAP_FOR: Record<Kind, keyof RefMaps> = {
  $product: 'products',
  $category: 'categories',
  $media: 'media',
}

/**
 * Is this value a pack reference — an object whose ONLY key is one of the three
 * sentinels, with a string value?
 *
 * The single-key requirement matters: a block field that legitimately contains
 * `$product` alongside other keys is data, not a pointer, and rewriting it to an
 * integer would corrupt the block.
 */
function refKind(value: unknown): Kind | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 1) return null
  const key = keys[0] as Kind
  if (!KINDS.includes(key)) return null
  return typeof (value as Record<string, unknown>)[key] === 'string' ? key : null
}

/**
 * Replace every pack reference in a layout with the id it names.
 *
 * Walks the structure rather than enumerating the fourteen block fields that
 * currently carry a foreign key today. A hardcoded field list would silently skip any
 * block added later — the same failure mode as CSS variables that are emitted
 * and read by nothing.
 *
 * Throws on a reference that names nothing. A pack with a typo'd slug must fail
 * loudly at seed time (where the caller's rollback unwinds it) rather than write
 * a page with null relationships that renders as a blank section.
 */
export function resolvePackRefs(layout: PackBlock[], maps: RefMaps): PackBlock[] {
  const walk = (value: unknown, blockType: string): unknown => {
    const kind = refKind(value)
    if (kind) {
      const slug = (value as Record<string, string>)[kind]
      const id = maps[MAP_FOR[kind]].get(slug)
      if (id === undefined) {
        throw new Error(
          `Pack homepage references ${kind} "${slug}" in block "${blockType}", ` +
            `but the pack's catalogue defines no such entry.`,
        )
      }
      return id
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, blockType))
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v, blockType)]),
      )
    }
    return value
  }

  return layout.map((block) => walk(block, block.blockType) as PackBlock)
}

/**
 * Every distinct media filename a layout references.
 *
 * The seeder uploads one image per product; a homepage may reference a file no
 * product uses. Without this, that file is never created and its reference
 * cannot resolve.
 */
export function collectMediaRefs(layout: PackBlock[] | undefined): string[] {
  const found = new Set<string>()
  const walk = (value: unknown): void => {
    if (refKind(value) === '$media') {
      found.add((value as { $media: string }).$media)
      return
    }
    if (Array.isArray(value)) return value.forEach(walk)
    if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk)
  }
  ;(layout ?? []).forEach(walk)
  return [...found]
}
