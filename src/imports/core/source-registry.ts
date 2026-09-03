/**
 * Source registry — the ONLY place that maps a slug to an import adapter.
 *
 * Adding a source is: create `src/imports/sources/<id>.ts`, export the adapter,
 * and register it in `WIRED` below. Nothing else in the codebase may branch on
 * a source slug — `no-slug-branching.test.ts` enforces that, the same way
 * `provider-registry.ts` works for payments.
 */
import type { ImportSource } from './types'
import { shopifySource } from '../sources/shopify'
import { wooSource } from '../sources/woocommerce'

export type SourceRegistry = {
  /** Look up a source by id. Returns null for unknown ids. */
  get(id: string): ImportSource | null
  /** Look up a source or throw. */
  require(id: string): ImportSource
  /** All registered sources, in registration order. */
  list(): ImportSource[]
}

export function createSourceRegistry(sources: ImportSource[]): SourceRegistry {
  const byId = new Map<string, ImportSource>()

  for (const source of sources) {
    if (byId.has(source.id)) {
      // Two adapters claiming one id means one of them silently never runs.
      throw new Error(`Duplicate import source id: ${source.id}`)
    }
    byId.set(source.id, source)
  }

  const ordered = [...sources]

  return {
    get: (id) => byId.get(id) ?? null,
    require(id) {
      const source = byId.get(id)
      if (!source) {
        const known = ordered.map((s) => s.id).join(', ') || 'none registered yet'
        throw new Error(`Unknown import source: ${id} (known: ${known})`)
      }
      return source
    },
    list: () => [...ordered],
  }
}

/**
 * The wired registry.
 *
 * Adding a source is one import above and one entry here, and nothing else.
 * Both current entries went in exactly that way, which is the point of doing
 * two sources before shipping rather than one.
 */
const WIRED: ImportSource[] = [shopifySource, wooSource]

export const sourceRegistry: SourceRegistry = createSourceRegistry(WIRED)
