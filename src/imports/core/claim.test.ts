import { describe, it, expect } from 'vitest'
import { claimItems } from './import'

type Item = { id: number; status: string; claimedAt: string | null; mapped: unknown }

type WhereLeaf = {
  status?: { equals: string }
  claimedAt?: { exists?: boolean; less_than?: string }
  id?: { equals: number }
  job?: { equals: number }
  or?: WhereLeaf[]
}
type Where = { and?: WhereLeaf[]; or?: WhereLeaf[] }

/**
 * A fake payload that evaluates the ACTUAL `where` clause `claimItems` builds
 * against an in-memory row set. It deliberately does NOT know the reclaim rule
 * itself — it just interprets the query — so a stale item is only returned if
 * `claimItems` truly asks for stale claims. That is what makes the reclaim test
 * fail until the real query is fixed.
 */
function matches(row: Item, w: WhereLeaf): boolean {
  if (w.or) return w.or.some((leaf) => matches(row, leaf))
  if (w.status && row.status !== w.status.equals) return false
  if (w.id && row.id !== w.id.equals) return false
  if (w.claimedAt?.exists === false && row.claimedAt !== null) return false
  if (w.claimedAt?.less_than !== undefined) {
    if (row.claimedAt === null || row.claimedAt >= w.claimedAt.less_than) return false
  }
  return true
}
const passes = (row: Item, where: Where): boolean =>
  (where.and ?? [where]).every((leaf) => matches(row, leaf))

function fakePayload(rows: Item[]) {
  return {
    find: async ({ where, limit }: { where: Where; limit: number }) => ({
      docs: rows.filter((r) => passes(r, where)).slice(0, limit),
    }),
    update: async ({ where, data }: { where: Where; data: { claimedAt: string } }) => {
      const row = rows.find((r) => passes(r, where))
      if (row) {
        row.claimedAt = data.claimedAt
        return { docs: [row] }
      }
      return { docs: [] }
    },
  }
}

const now = () => new Date('2026-08-04T12:00:00.000Z')
const STALE = 2 * 60 * 1000
const ago = (ms: number) => new Date(now().getTime() - ms).toISOString()

describe('claimItems', () => {
  it('claims an unclaimed selected item', async () => {
    const rows: Item[] = [{ id: 1, status: 'selected', claimedAt: null, mapped: { title: 'A' } }]
    const payload = fakePayload(rows)

    const claimed = await claimItems(payload as never, 7, 5, now, STALE)

    expect(claimed.map((c) => c.id)).toEqual([1])
    expect(rows[0].claimedAt).toBe(now().toISOString())
  })

  it('does not touch a freshly claimed item — another tick holds it', async () => {
    const rows: Item[] = [{ id: 1, status: 'selected', claimedAt: ago(10_000), mapped: {} }]
    const payload = fakePayload(rows)

    const claimed = await claimItems(payload as never, 7, 5, now, STALE)

    expect(claimed).toEqual([])
  })

  // The fix for a stuck import: if a tick died mid-import, its claim goes stale
  // and the item must be reclaimable, or the import can never finish.
  it('reclaims an item whose claim has gone stale', async () => {
    const rows: Item[] = [{ id: 1, status: 'selected', claimedAt: ago(5 * 60 * 1000), mapped: {} }]
    const payload = fakePayload(rows)

    const claimed = await claimItems(payload as never, 7, 5, now, STALE)

    expect(claimed.map((c) => c.id)).toEqual([1])
  })

  it('never reclaims an item that already imported', async () => {
    const rows: Item[] = [{ id: 1, status: 'imported', claimedAt: ago(5 * 60 * 1000), mapped: {} }]
    const payload = fakePayload(rows)

    expect(await claimItems(payload as never, 7, 5, now, STALE)).toEqual([])
  })
})
