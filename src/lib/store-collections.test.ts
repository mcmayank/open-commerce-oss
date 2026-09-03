import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { STORE_COLLECTIONS, isStoreCollection } from './store-collections'

const COLLECTIONS_DIR = path.resolve(__dirname, '../collections')

/** Slugs declared by the core collection files. */
function coreSlugs(): string[] {
  return readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    .map((f) => /\bslug:\s*['"]([a-z0-9-]+)['"]/.exec(readFileSync(path.join(COLLECTIONS_DIR, f), 'utf8'))?.[1])
    .filter((s): s is string => Boolean(s))
}

describe('STORE_COLLECTIONS', () => {
  it('names only collections that exist in core, plus voice-configs (hosted, scoped when present)', () => {
    const core = new Set(coreSlugs())
    for (const slug of STORE_COLLECTIONS) {
      if (slug === 'voice-configs') continue
      expect(core.has(slug), slug).toBe(true)
    }
  })

  it('covers every core collection except users', () => {
    const missing = coreSlugs().filter((s) => s !== 'users' && !isStoreCollection(s))
    expect(missing).toEqual([])
  })

  it('never includes the hosted-only collections', () => {
    for (const slug of ['tenants', 'domains', 'users']) expect(isStoreCollection(slug)).toBe(false)
  })

  it('no core collection wraps itself in the hosted tenant-scoping helper any more', () => {
    for (const f of readdirSync(COLLECTIONS_DIR)) {
      if (!f.endsWith('.ts') || f.includes('.test.')) continue
      expect(readFileSync(path.join(COLLECTIONS_DIR, f), 'utf8'), f).not.toMatch(new RegExp('tenantScoped' + 'Collection\\s*\\('))
    }
  })
})
