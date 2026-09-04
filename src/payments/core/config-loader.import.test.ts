import { readdirSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Guards the import graph, not the behaviour.
 *
 * `config-loader.ts` used to `import config from '@payload-config'` at module
 * top level. Because `Orders.ts` imports this module, ANY unit test that touched
 * `Orders.ts` transitively evaluated `payload.config.ts`, which calls
 * `resolveDatabaseUrl()` and throws when `DATABASE_URL` is unset.
 *
 * The failure was worse than a normal error: Vitest reported the file as failed
 * with "Tests: no tests" and exit 1 — zero assertions ran, so a suite could look
 * broken without a single test having executed. That cost a full redesign of the
 * nav-groups tests before the cause was found.
 *
 * `@payload-config` is now imported lazily, inside the one function that needs a
 * Payload instance, matching the pattern already used in `src/hosted/lib/admin-host.ts`
 * and `src/lib/auth/session.ts`.
 *
 * This test asserts the property directly: importing the module — and the
 * collection that pulls it in — must not require a database. It runs under the
 * normal suite, where `DATABASE_URL` may or may not be set, so it deliberately
 * clears the variable itself rather than depending on the ambient environment.
 */
describe('config-loader import graph', () => {
  // Without this, the first test pulls `@payload-config` into Vitest's module
  // registry and every later import reuses the cached graph — so a second test
  // would pass even against the eager-import version. Observed while writing
  // this file: the Orders case passed for exactly that wrong reason.
  beforeEach(() => {
    vi.resetModules()
  })

  it('imports without a database configured', async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const mod = await import('./config-loader')
      // Positive: the module really loaded and exposes its API.
      expect(typeof mod.getStorePaymentConfig).toBe('function')
      // Comparative: a name that does not exist must be absent, so this cannot
      // pass against an empty or stubbed module object.
      expect((mod as Record<string, unknown>).notARealExport).toBeUndefined()
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = saved
    }
  })

  it('lets a collection that depends on it import without a database too', async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const { Orders } = await import('@/collections/Orders')
      expect(Orders.slug).toBe('orders')
      expect(Orders.slug).not.toBe('')
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = saved
    }
  })

  /**
   * The general property, rather than the one collection that happened to break.
   *
   * `Orders.ts` was the collection that surfaced this, but any collection could
   * acquire the same transitive dependency tomorrow — a new import of a lib that
   * eagerly pulls `@payload-config` would reintroduce it silently. Walking the
   * directory means a future collection is covered without anyone remembering to
   * add it here.
   */
  it('imports EVERY collection without a database', async () => {
    const files = readdirSync(path.resolve(__dirname, '../../collections'))
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .sort()

    // Guard: if the directory scan ever returns nothing, the loop below would
    // vacuously pass. This repo has shipped assertions that passed because
    // nothing ran; refuse to be one of them.
    expect(files.length).toBeGreaterThan(10)

    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    const failed: string[] = []
    try {
      for (const file of files) {
        vi.resetModules()
        try {
          await import(`@/collections/${file.replace(/\.ts$/, '')}`)
        } catch (err) {
          failed.push(`${file}: ${(err as Error).message.split('\n')[0]}`)
        }
      }
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = saved
    }

    expect(failed, `collections requiring a database at import time:\n${failed.join('\n')}`)
      .toEqual([])
  })
})
