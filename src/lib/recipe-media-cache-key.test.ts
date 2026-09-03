import { describe, expect, it, vi } from 'vitest'

/**
 * Isolated in its own file, not folded into recipe-media.test.ts, because it
 * mocks the whole `react` module — doing that inside a shared file would leak
 * a memoizing `cache()` into every other test there (vitest isolates modules
 * per test FILE, not per `it()`), silently breaking their independence.
 *
 * Bare `react`'s `cache()` is an identity passthrough outside a real RSC
 * render — see `node_modules/react/cjs/react.development.js`:
 * `exports.cache = function (fn) { return function () { return
 * fn.apply(null, arguments) } }`. It never memoizes under vitest, confirmed
 * empirically: calling a `cache()`-wrapped function twice with the SAME
 * primitive arguments still invokes the underlying function twice. So this
 * test cannot prove React's production memoization fires — that only
 * happens inside an actual request/render — and does not claim to. What it
 * proves is narrower and fully within reach: `resolveRecipeMedia`'s
 * key-building wrapper (sort + join) hands a stable, order-independent
 * string key to the memoized function, so that IF `cache()` memoizes (as it
 * does in production), two sections referencing the same media ids in any
 * order collapse onto one query rather than each building their own
 * unshareable array-identity key.
 */
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const memoize = (fn: (...args: unknown[]) => unknown) => {
    const store = new Map<string, unknown>()
    return (...args: unknown[]) => {
      // Payload/functions serialize away under JSON.stringify; fine here
      // since every call in this test shares the same payload stub.
      const key = JSON.stringify(args, (_k, v) => (typeof v === 'function' ? undefined : v))
      if (!store.has(key)) store.set(key, fn(...args))
      return store.get(key)
    }
  }
  return { ...actual, cache: memoize }
})

describe('resolveRecipeMedia — cache key stability', () => {
  it('collapses two equal-but-differently-ordered id arrays onto ONE underlying query', async () => {
    // Fresh module instance per test — otherwise the mocked cache()'s `store`
    // (closed over inside the imported module) would persist across `it()`
    // blocks and one test's cached entries would leak into the next.
    vi.resetModules()
    const { resolveRecipeMedia } = await import('./recipe-media')

    const calls: unknown[] = []
    const payload = {
      find: async (args: unknown) => {
        calls.push(args)
        return { docs: [{ id: 7, url: '/a.jpg', alt: 'a' }, { id: 9, url: '/b.jpg', alt: 'b' }] }
      },
    } as unknown as Parameters<typeof resolveRecipeMedia>[0]

    await resolveRecipeMedia(payload, 1, ['7', '9'])
    // A different array INSTANCE, same ids, reverse order — collectMediaIds
    // never guarantees a stable order across sections, so this is the case
    // that matters.
    await resolveRecipeMedia(payload, 1, ['9', '7'])

    expect(calls).toHaveLength(1)
  })

  it('does not collapse two DIFFERENT id sets onto the same query', async () => {
    vi.resetModules()
    const { resolveRecipeMedia } = await import('./recipe-media')

    const calls: unknown[] = []
    const payload = {
      find: async (args: unknown) => {
        calls.push(args)
        return { docs: [] }
      },
    } as unknown as Parameters<typeof resolveRecipeMedia>[0]

    await resolveRecipeMedia(payload, 1, ['7', '9'])
    await resolveRecipeMedia(payload, 1, ['7', '10'])

    expect(calls).toHaveLength(2)
  })
})
