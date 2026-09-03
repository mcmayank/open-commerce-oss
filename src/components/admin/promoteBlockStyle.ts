import type { BlockStyle } from '@/lib/block-style/vocabulary'

/**
 * Write this block's style as the store-wide default for its block type.
 *
 * The ONLY place the page builder writes outside the document it is editing, so
 * it is deliberately a separate, testable module rather than an inline fetch in
 * a component. `blockStyleDefaults` is a hidden json field on StoreSettings; the
 * REST route applies the collection's tenant-scoped access control, which is why
 * this goes through `/api/store-settings` with credentials rather than a bespoke
 * server action that would have to re-implement that check.
 *
 * The blockType entry is REPLACED, not deep-merged: "use this heading style for
 * all Product Grids" means the promoted style IS the default, and merging would
 * leave behind keys the merchant had already cleared.
 */
export async function promoteBlockStyle(blockType: string, style: BlockStyle): Promise<void> {
  const res = await fetch('/api/store-settings?limit=1&depth=0', { credentials: 'include' })
  const list = await res.json()
  const doc = list?.docs?.[0]
  if (!doc?.id) throw new Error('No store settings document to write block style defaults to')

  const current =
    doc.blockStyleDefaults && typeof doc.blockStyleDefaults === 'object' ? doc.blockStyleDefaults : {}

  const patch = await fetch(`/api/store-settings/${doc.id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockStyleDefaults: { ...current, [blockType]: style } }),
  })
  if (!patch.ok) throw new Error(`Could not save store-wide defaults (${patch.status})`)
}
