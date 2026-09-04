import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Nothing outside an adapter and the registry may branch on a source slug.
 * This is the same rule `provider-registry.ts` enforces for payments, and it is
 * what makes adding a third source one folder plus one registry line instead of
 * a hunt through the codebase for `if (source === 'shopify')`.
 */
const SRC_ROOT = join(import.meta.dirname, '..', '..')

/** Slugs that belong to adapters. Extend when a source is added. */
const SOURCE_SLUGS = ['shopify', 'woocommerce']

/**
 * A quoted slug literal — the thing you would branch on.
 *
 * Case-SENSITIVE on purpose. The ids are lowercase, so `'shopify'` is a branch
 * while `"Shopify"` is the brand name in display copy: the pricing page has
 * `label="Shopify's gateway penalty"`, which is customer-facing prose about a
 * competitor and has nothing to do with this registry. Matching it would train
 * everyone to ignore this test.
 */
const SLUG_LITERAL = new RegExp(`['"\`](${SOURCE_SLUGS.join('|')})['"\`]`)

function isAllowed(file: string): boolean {
  const rel = relative(SRC_ROOT, file)
  // Adapters own their own slug, and the registry is where they are wired.
  if (rel.startsWith(join('imports', 'sources') + sep)) return true
  if (rel === join('imports', 'core', 'source-registry.ts')) return true
  // Tests legitimately name slugs to assert on them.
  if (rel.includes('.test.')) return true
  return false
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      out.push(...walk(full))
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function findOffenders(): string[] {
  const offenders: string[] = []
  for (const file of walk(SRC_ROOT)) {
    if (isAllowed(file)) continue
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const trimmed = line.trimStart()
        // Prose mentioning Shopify is not branching on it.
        if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
        if (SLUG_LITERAL.test(line)) {
          offenders.push(`${relative(SRC_ROOT, file)}:${i + 1}: ${trimmed}`)
        }
      })
  }
  return offenders
}

describe('source slugs stay inside their adapter and the registry', () => {
  it('finds no slug literal anywhere else in src/', () => {
    expect(findOffenders()).toEqual([])
  })

  // The scan above passes trivially while no adapter exists. These pin the
  // matcher so it cannot quietly stop working before it is ever needed.
  it('recognises a slug literal when it sees one', () => {
    expect(SLUG_LITERAL.test("if (source === 'shopify') {")).toBe(true)
    expect(SLUG_LITERAL.test('const id = "woocommerce"')).toBe(true)
    expect(SLUG_LITERAL.test('case `shopify`:')).toBe(true)
  })

  it('does not flag prose or unrelated identifiers', () => {
    expect(SLUG_LITERAL.test(' * Shopify sends decimal strings.')).toBe(false)
    expect(SLUG_LITERAL.test('const shopifyish = 1')).toBe(false)
    expect(SLUG_LITERAL.test("import { x } from './shopify-helpers'")).toBe(false)
  })

  // Regression: this scan's first run flagged two of these, which are the
  // competitor's brand name in pricing copy rather than an import source id.
  it('does not flag the brand name in customer-facing copy', () => {
    expect(SLUG_LITERAL.test('label="Shopify\'s gateway penalty"')).toBe(false)
    expect(SLUG_LITERAL.test('<Bar label="Shopify" pct={shopifyBar} />')).toBe(false)
  })
})
