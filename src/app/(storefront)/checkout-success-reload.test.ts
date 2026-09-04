import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The checkout success page must navigate with a plain <a>, never <Link>.
 *
 * `CartClearer` clears the cart COOKIE on mount, but `CartProvider` holds its
 * summary in `useState(initial)` seeded once from a server prop, with no
 * refetch on navigation. A client-side <Link> keeps that provider mounted, so
 * the customer lands on the home page with the order they just paid for still
 * showing in the cart badge.
 *
 * A full document navigation remounts the provider and re-reads the (now empty)
 * cookie. That is why these are `<a>`, and `@next/next/no-html-link-for-pages`
 * is off (see eslint.config.mjs) — left on, it flags exactly this and invites
 * the "fix" that breaks it.
 *
 * Source-level assertion in the spirit of stripe.test.ts: the property is about
 * which element the file uses, which is cheaper and more direct to read off the
 * source than to reconstruct through a render.
 */
const SUCCESS_PAGE = resolve(
  __dirname,
  'store/[tenant]/checkout/success/page.tsx',
)

describe('checkout success navigates with a full page load', () => {
  const src = readFileSync(SUCCESS_PAGE, 'utf-8')

  it('links home with a plain anchor', () => {
    expect(src).toMatch(/<a\s+[^>]*href="\/"/)
  })

  it('does not import next/link', () => {
    // The whole point: a <Link> here leaves CartProvider mounted holding the
    // pre-purchase summary.
    expect(src).not.toMatch(/from ['"]next\/link['"]/)
  })

  it('still clears the cart cookie on mount', () => {
    // The <a> only matters because something cleared the cookie first. If
    // CartClearer is removed the reload resyncs to a cart that was never
    // emptied, and this guard would be protecting nothing.
    expect(src).toContain('CartClearer')
  })

  it('CartProvider still has no refetch, which is what makes the reload necessary', () => {
    // If CartProvider ever gains a pathname-driven refetch, the constraint above
    // is obsolete and these <a> tags can become <Link>. This fails loudly at
    // that point rather than leaving a stale rule in the eslint config.
    const provider = readFileSync(
      resolve(__dirname, 'store/[tenant]/components/cart/CartProvider.tsx'),
      'utf-8',
    )
    expect(provider).not.toMatch(/usePathname|router\.refresh/)
  })
})
