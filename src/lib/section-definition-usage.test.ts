import { describe, expect, it } from 'vitest'
import { countPagesUsingDefinition } from './section-definition-usage'

type Args = Parameters<typeof countPagesUsingDefinition>[0]
type FindCall = {
  collection: string
  where: unknown
  limit?: number
  depth?: number
  overrideAccess?: boolean
  draft?: boolean
}

/**
 * The scan cap both queries must use. Understating the count is safe — the delete
 * guard fires on any count above zero — but the guard's MESSAGE names the number,
 * so a narrowed limit makes it untrue: "used on 1 page" sends the merchant to clear
 * that one page, retry, and get the same message with no way to find the rest.
 * Narrowing either query to `limit: 1` used to pass every test in this file.
 */
const SCAN_LIMIT = 1000

type VersionRow = { parent: string; latest: boolean }

/**
 * A fake that behaves enough like Payload to catch a wrong `where` clause, not
 * just a wrong return value: it records every call it receives so a test can
 * assert on the exact collection/path/overrideAccess sent, and `findVersions`
 * actually applies the `latest` condition to its fixture rows the way Postgres
 * would apply an indexed boolean filter — so a dropped or wrong `latest`
 * constraint changes what gets counted, not merely what gets logged.
 */
function fakePayload(pages: { id: string }[], versions: VersionRow[]) {
  const calls: { find?: FindCall; findVersions?: FindCall } = {}
  const payload = {
    find: async (args: FindCall) => {
      calls.find = args
      return { docs: pages }
    },
    findVersions: async (args: FindCall) => {
      calls.findVersions = args
      const where = args.where as { and?: { latest?: { equals?: boolean } }[] } | undefined
      const latestCondition = where?.and?.find((c) => 'latest' in c)?.latest?.equals
      const filtered =
        latestCondition === undefined ? versions : versions.filter((v) => v.latest === latestCondition)
      return { docs: filtered }
    },
  } as unknown as Args
  return { payload, calls }
}

describe('countPagesUsingDefinition', () => {
  it('counts published pages', async () => {
    const { payload } = fakePayload([{ id: 'p1' }], [])
    expect(await countPagesUsingDefinition(payload, 'd1')).toBe(1)
  })

  it('counts a draft-only reference, which lives in the versions table', async () => {
    const { payload } = fakePayload([], [{ parent: 'p2', latest: true }])
    expect(await countPagesUsingDefinition(payload, 'd1')).toBe(1)
  })

  it('counts a page once when it appears in both sources', async () => {
    const { payload } = fakePayload([{ id: 'p1' }], [{ parent: 'p1', latest: true }])
    expect(await countPagesUsingDefinition(payload, 'd1')).toBe(1)
  })

  it('returns 0 when nothing references it', async () => {
    const { payload } = fakePayload([], [])
    expect(await countPagesUsingDefinition(payload, 'd1')).toBe(0)
  })

  it('does not count a retained version row that is not the latest one', async () => {
    // Pages keeps up to 20 historical version rows (maxPerDoc: 20). A page that
    // used the definition once and later removed it still has an old, non-latest
    // row referencing it — that must not block a delete.
    const { payload } = fakePayload([], [{ parent: 'p3', latest: false }])
    expect(await countPagesUsingDefinition(payload, 'd1')).toBe(0)
  })

  it('queries current pages by collection, layout.definition path, and overrideAccess', async () => {
    const { payload, calls } = fakePayload([], [])
    await countPagesUsingDefinition(payload, 'd1')
    expect(calls.find?.collection).toBe('pages')
    expect(calls.find?.where).toMatchObject({ 'layout.definition': { equals: 'd1' } })
    expect(calls.find?.overrideAccess).toBe(true)
    expect(calls.find?.limit).toBe(SCAN_LIMIT)
  })

  it('reads published main-table rows, never the draft-aware view', async () => {
    // The whole two-query design rests on this `find` meaning "published uses it"
    // and `findVersions` meaning "the current draft uses it". `draft: true` would
    // make the first query return latest-version rows instead, silently merging
    // the two meanings and double-counting nothing while missing the published
    // state entirely — with all seven tests above still green.
    const { payload, calls } = fakePayload([], [])
    await countPagesUsingDefinition(payload, 'd1')
    expect(calls.find?.draft).toBeUndefined()
  })

  it('queries versions by collection, the version.layout.definition path, latest, and overrideAccess', async () => {
    const { payload, calls } = fakePayload([], [])
    await countPagesUsingDefinition(payload, 'd1')
    expect(calls.findVersions?.collection).toBe('pages')
    expect(calls.findVersions?.where).toMatchObject({
      and: expect.arrayContaining([
        { latest: { equals: true } },
        { 'version.layout.definition': { equals: 'd1' } },
      ]),
    })
    expect(calls.findVersions?.overrideAccess).toBe(true)
    expect(calls.findVersions?.limit).toBe(SCAN_LIMIT)
  })
})
