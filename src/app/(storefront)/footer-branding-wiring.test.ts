import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * `Footer` takes a required `showBranding: boolean` (Decision 2,
 * docs/superpowers/specs/2026-08-02-storefront-branding-gate-design.md) so the
 * compiler catches a render site that *forgets* the prop. It cannot catch one
 * that passes a hardcoded literal — `showBranding={true}` / `{false}` compiles
 * fine and silently defeats the gate at that one site.
 *
 * Asserted against source, same idiom as ../ring-fence.test.ts: the guarantee
 * is about how every render site wires the prop, which a rendered-output test
 * can't see (a literal `true` and `showsNiblrBranding(store)` evaluating to
 * `true` render identically). Every `<Footer` under this route group must be
 * paired with a `showsNiblrBranding(` call in the same file.
 *
 * `Footer.test.tsx` is deliberately excluded: it renders the component
 * directly with literal booleans to test both states, which is the correct
 * thing for a unit test to do — the rule below is about production render
 * sites, not about the component's own test.
 */
const ROOT = join(process.cwd(), 'src/app/(storefront)')

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const RENDER_SITES = collectSourceFiles(ROOT)
  .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
  .filter(({ source }) => source.includes('<Footer'))

describe('Footer render sites wire showsNiblrBranding, not a literal', () => {
  it('found at least one <Footer render site to check', () => {
    // A non-vacuous guard: if this hits zero, the scan itself is broken (wrong
    // root, or every render site got renamed) and every assertion below would
    // otherwise pass by finding nothing to fail on.
    expect(RENDER_SITES.length).toBeGreaterThan(0)
  })

  for (const { path, source } of RENDER_SITES) {
    it(`${relative(ROOT, path)} passes showsNiblrBranding( to <Footer`, () => {
      expect(source).toContain('showsNiblrBranding(')
    })
  }
})
