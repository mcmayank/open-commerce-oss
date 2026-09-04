import type { Payload, PayloadRequest } from 'payload'
import type { Page } from '@/payload-types'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { storeWhere, storeRef } from '@/store-scope'

/**
 * The starter homepage every tenant gets by default: a real, editable `home`
 * Page (slug 'home') the storefront renders in place of the hardcoded fallback.
 * A neutral, store-type-agnostic layout — the tenant customises from here.
 * All blocks are non-premium so it provisions on any plan.
 */
export function buildDefaultHomeLayout(storeName: string): NonNullable<Page['layout']> {
  const layout = [
    {
      blockType: 'hero',
      variant: 'centered',
      heading: storeName,
      subheading: 'Welcome — take a look around and find something you love.',
      ctaLabel: 'Shop now',
      ctaHref: '/products',
    },
    {
      blockType: 'productGrid',
      variant: 'grid',
      columns: '4',
      heading: 'Featured products',
      source: 'latest',
      limit: 8,
    },
    {
      blockType: 'incentives',
      columns: '3',
      items: [
        { icon: 'truck', heading: 'Fast delivery', text: 'Quick, reliable shipping on every order.' },
        { icon: 'returns', heading: 'Easy returns', text: 'Changed your mind? Returns are simple.' },
        { icon: 'lock', heading: 'Secure checkout', text: 'Your payment details are always protected.' },
      ],
    },
  ]
  return layout as unknown as NonNullable<Page['layout']>
}

/**
 * Keys Payload adds on save that `buildDefaultHomeLayout` never emits: a
 * generated `id` on every block and every array row, and `blockName`, which the
 * admin leaves null unless the merchant names a block by hand.
 */
const GENERATED_KEYS = new Set(['id', 'blockName'])

/**
 * Serialise a layout to a form that survives a round-trip through Payload, so a
 * saved layout can be compared with the plain object `buildDefaultHomeLayout`
 * returns.
 *
 * Three differences have to be flattened, all of them Payload's doing:
 *  - generated keys (above);
 *  - unset optional fields, which Payload materialises as `null` or `[]`
 *    (`backgroundImage: null`, `eyebrow: null`, `products: []`) where the source
 *    object simply omits the key;
 *  - key order, which comes from the collection's field order on the way out and
 *    from the literal on the way in — hence the sort.
 *
 * All of it is applied to BOTH sides, so it can never make two layouts that
 * genuinely differ on a field one of them sets compare equal.
 */
/**
 * Field defaults per block type, read from the block configs themselves.
 *
 * Payload materialises every field's `defaultValue` on save, so a block gains
 * keys the moment its schema does — and `buildDefaultHomeLayout` only ever
 * emits the handful of fields the starter homepage actually sets. Comparing
 * them raw therefore breaks on schema growth rather than on merchant edits.
 *
 * That is not hypothetical: the unified-Hero work added ~19 fields to the hero
 * block, five of which carry non-null defaults (`mediaSide: 'right'`,
 * `textAlign: 'center'`, `verticalAlign: 'middle'`, `overlay: 'medium'`,
 * `minHeight: 'lg'`). Every freshly provisioned homepage started reading as
 * EDITED, so `seedSampleCatalogue` silently skipped installing the pack
 * homepage for every tenant — merchants got sample products against the bland
 * starter page and no error anywhere.
 *
 * Built lazily and cached: the registry pulls in every block config, and this
 * module is imported by the tenant-create hook.
 */
let blockDefaultsCache: Map<string, Map<string, unknown>> | null = null

function blockDefaults(): Map<string, Map<string, unknown>> {
  if (blockDefaultsCache) return blockDefaultsCache
  const byBlock = new Map<string, Map<string, unknown>>()
  for (const block of PAGE_BLOCKS) {
    const fields = new Map<string, unknown>()
    for (const field of (block.fields ?? []) as { name?: string; defaultValue?: unknown }[]) {
      if (typeof field.name === 'string' && field.defaultValue !== undefined) {
        fields.set(field.name, field.defaultValue)
      }
    }
    if (block.slug) byBlock.set(block.slug, fields)
  }
  blockDefaultsCache = byBlock
  return byBlock
}

/**
 * Serialise a layout to a form that survives a round-trip through Payload, so a
 * saved layout can be compared with the plain object `buildDefaultHomeLayout`
 * returns.
 *
 * Four differences have to be flattened, all of them Payload's doing:
 *  - generated keys (above);
 *  - unset optional fields, which Payload materialises as `null` or `[]`
 *    (`backgroundImage: null`, `eyebrow: null`, `products: []`) where the source
 *    object simply omits the key;
 *  - fields sitting at their schema `defaultValue`, which Payload writes on
 *    every save and which the source object likewise omits — see `blockDefaults`
 *    for why this one is load-bearing;
 *  - key order, which comes from the collection's field order on the way out and
 *    from the literal on the way in — hence the sort.
 *
 * All of it is applied to BOTH sides, so it can never make two layouts that
 * genuinely differ on a field one of them sets compare equal. Dropping
 * at-default fields keeps that property: a merchant who changes `overlay` from
 * `'medium'` to `'heavy'` still differs, because the new value is not the
 * default. Only a change that leaves a field exactly at its default is treated
 * as no change — which is what it is.
 */
function layoutFingerprint(value: unknown, defaults?: Map<string, unknown>): string {
  if (Array.isArray(value)) return `[${value.map((v) => layoutFingerprint(v)).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    // A block identifies its own defaults; nested rows inherit none.
    const blockType = typeof record.blockType === 'string' ? record.blockType : null
    const fieldDefaults = blockType ? blockDefaults().get(blockType) : defaults

    const entries = Object.entries(record)
      .filter(([k, v]) => {
        if (GENERATED_KEYS.has(k)) return false
        if (v === null || v === undefined) return false
        if (Array.isArray(v) && v.length === 0) return false
        // At its schema default is indistinguishable from unset: Payload writes
        // one and `buildDefaultHomeLayout` omits the other.
        if (fieldDefaults && fieldDefaults.has(k) && fieldDefaults.get(k) === v) return false
        return true
      })
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${layoutFingerprint(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/**
 * Is this layout still the untouched starter homepage `provisionHomePage` wrote,
 * or has the merchant edited it?
 *
 * The sample seeder asks before it overwrites a tenant's `home` page. Getting
 * this wrong is destructive in one direction and inert in the other: a false
 * "edited" only means a pack's homepage never installs, while a false
 * "untouched" destroys work the merchant cannot get back.
 *
 * KNOWN LIMIT: an edit that changes ONLY the hero heading is indistinguishable
 * from a store rename (both leave a default layout carrying a name that is not
 * the current one), and is read as a rename. That costs the merchant one string;
 * treating it the other way would cost every renamed store the feature entirely.
 * Any other edit — a block added, removed, reordered, or any other field changed
 * — is detected.
 */
export function isUntouchedDefaultHome(layout: unknown, storeName: string): boolean {
  const actual = layoutFingerprint(layout ?? [])
  if (actual === layoutFingerprint(buildDefaultHomeLayout(storeName))) return true

  // Renaming a store does not rewrite its pages, so a provisioned homepage keeps
  // whatever the store was called when the tenant was created. Without this
  // second comparison every renamed store would read as edited and no pack
  // homepage would ever install for one.
  const heading = (layout as { heading?: unknown }[] | null | undefined)?.[0]?.heading
  if (typeof heading !== 'string' || heading === storeName) return false
  return actual === layoutFingerprint(buildDefaultHomeLayout(heading))
}

/**
 * Idempotently ensure a tenant has a `home` page. Creates a published starter
 * homepage only when none exists (any status), so re-runs and hooks are safe
 * and a tenant's own edits are never overwritten. Returns whether it created one.
 */
export async function provisionHomePage(
  payload: Payload,
  opts: { tenantId: number; storeName: string },
  // Pass the hook's `req` so the page insert joins the same transaction as the
  // tenant creation — otherwise the not-yet-committed tenant row isn't visible
  // to a separate transaction and the FK insert fails.
  req?: PayloadRequest,
): Promise<{ created: boolean }> {
  const existing = await payload.find({
    collection: 'pages',
    where: { and: [storeWhere(opts.tenantId), { slug: { equals: 'home' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) return { created: false }

  await payload.create({
    collection: 'pages',
    data: {
      title: 'Home',
      slug: 'home',
      ...storeRef(opts.tenantId),
      layout: buildDefaultHomeLayout(opts.storeName),
      _status: 'published' as const,
    },
    overrideAccess: true,
    req,
  })
  return { created: true }
}
