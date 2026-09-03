import { describe, it, expect } from 'vitest'
import { Pages } from './Pages'

/**
 * The one guard standing between an agent and a live storefront.
 *
 * `updatePages` comes from @payloadcms/plugin-mcp and REPLACES `layout` with
 * whatever the client sends — there is no merge. An AI client that composes a
 * page from a partial understanding drops every block it did not mention, which
 * is precisely the mistake made by hand on 29 Aug 2026 while verifying
 * customSection: a `layout.filter(b => b.blockType !== 'customSection')` before
 * appending replaced the page's existing placement instead of adding to it.
 *
 * That was recoverable only because Pages keeps 20 versions. The thing that
 * keeps it recoverable in production is this hook: an MCP write is forced to
 * `draft`, so the published page a customer sees is untouched until a human
 * reviews and publishes. If it regresses, an agent's clobber goes straight
 * live — silently, because a smaller layout is not an error.
 *
 * It had no test until now.
 */
type BeforeChangeArgs = { req: { payloadAPI?: string }; data: Record<string, unknown> }

/** The draft guard is deliberately FIRST in the chain — see the order test below. */
const draftGuard = Pages.hooks!.beforeChange![0] as (
  args: BeforeChangeArgs,
) => Record<string, unknown>

const layout = [
  { blockType: 'hero', heading: 'Kept' },
  { blockType: 'productGrid' },
  { blockType: 'faq' },
]

describe('Pages — MCP writes are forced to draft', () => {
  it('downgrades an MCP write that asks to publish', () => {
    const out = draftGuard({
      req: { payloadAPI: 'MCP' },
      data: { title: 'Home', layout, _status: 'published' },
    })

    expect(out._status).toBe('draft')
  })

  it('forces draft even when the write names no status at all', () => {
    // Payload defaults an unset _status to published for a drafts-enabled
    // collection, so silence must not be treated as consent.
    const out = draftGuard({ req: { payloadAPI: 'MCP' }, data: { title: 'Home', layout } })

    expect(out._status).toBe('draft')
  })

  it('leaves the rest of the payload untouched while downgrading', () => {
    const out = draftGuard({
      req: { payloadAPI: 'MCP' },
      data: { title: 'Home', layout, slug: 'home', _status: 'published' },
    })

    expect(out.title).toBe('Home')
    expect(out.slug).toBe('home')
    expect(out.layout).toEqual(layout)
  })

  it('does NOT touch a write from the admin UI or Local API', () => {
    // Only MCP is downgraded. A merchant hitting Publish, and the seed scripts,
    // must still be able to publish.
    for (const payloadAPI of ['REST', 'local', 'GraphQL', undefined]) {
      const out = draftGuard({
        req: { payloadAPI },
        data: { title: 'Home', layout, _status: 'published' },
      })
      expect(out._status, `payloadAPI=${payloadAPI}`).toBe('published')
    }
  })

  it('runs FIRST, before the entitlement and seeding hooks', () => {
    // Order is load-bearing: the later hooks return `data` unchanged on their
    // early-exit paths, so a guard placed after them would be skipped for any
    // write that exits early — exactly the unprivileged writes it must catch.
    //
    // Asserted by BEHAVIOUR, not identity. `expect(chain[0]).toBe(draftGuard)`
    // reads like a check but is a tautology, because `draftGuard` is itself
    // `chain[0]` — it passes even when a different hook is inserted ahead of the
    // guard, which is the one thing it is supposed to catch.
    const chain = Pages.hooks!.beforeChange!
    expect(chain.length).toBeGreaterThan(1)

    const first = chain[0] as (args: BeforeChangeArgs) => Record<string, unknown>
    const out = first({ req: { payloadAPI: 'MCP' }, data: { _status: 'published' } })
    expect(out._status).toBe('draft')
  })

  it('is a pure function of its input — it never mutates the caller’s data', () => {
    const data = { title: 'Home', layout, _status: 'published' }
    draftGuard({ req: { payloadAPI: 'MCP' }, data })

    // A mutating guard would corrupt the object Payload still holds a reference
    // to, which is how a "downgrade" silently becomes a rewrite.
    expect(data._status).toBe('published')
  })
})
