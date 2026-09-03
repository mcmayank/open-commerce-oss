import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * `safeFetch` is the import feature's only network boundary — it is what vets
 * the destination address, caps the response and keeps us polite to a
 * merchant's server. A direct `fetch` anywhere else in `src/imports/` silently
 * opts out of all three, so this test is the enforcement the spec asks for.
 */
const IMPORTS_ROOT = join(import.meta.dirname, '..')

/** The one file allowed to call the runtime's fetch. */
const ALLOWED = join(IMPORTS_ROOT, 'core', 'fetch.ts')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) out.push(full)
  }
  return out
}

/** Matches a call to bare `fetch(` but not `safeFetch(` / `fetchImpl(` / `.fetch(`. */
const DIRECT_FETCH = /(?<![.\w])fetch\s*\(/

describe('import code routes all network access through safeFetch', () => {
  it('finds no direct fetch( call outside core/fetch.ts', () => {
    const offenders: string[] = []

    for (const file of walk(IMPORTS_ROOT)) {
      if (file === ALLOWED) continue
      const source = readFileSync(file, 'utf8')
      source.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
        if (DIRECT_FETCH.test(line)) {
          offenders.push(`${relative(IMPORTS_ROOT, file)}:${i + 1}: ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })

  // A guard that has never caught anything is a guard nobody has tested. This
  // pins the matcher itself so the test above cannot quietly stop working.
  it('recognises a direct fetch call when it sees one', () => {
    expect(DIRECT_FETCH.test('  const res = await fetch(url)')).toBe(true)
    expect(DIRECT_FETCH.test('return fetch(`${origin}/products.json`)')).toBe(true)
    expect(DIRECT_FETCH.test('fetch (url)')).toBe(true)
  })

  it('does not mistake safeFetch or an injected impl for a direct call', () => {
    expect(DIRECT_FETCH.test('  const res = await safeFetch(url)')).toBe(false)
    expect(DIRECT_FETCH.test('  return deps.fetchImpl(url, init)')).toBe(false)
    expect(DIRECT_FETCH.test('  await ctx.fetch(url)')).toBe(false)
  })
})
