import { PER_STORE_GROUPS } from '@/collections/nav-groups'

export type NavItem = { slug: string; label: string; href: string; badge?: number }
export type NavGroup = { label: string; items: NavItem[] }
export type NavCollectionInput = { slug: string; label: string; group?: string; hidden?: boolean }

const PER_STORE = new Set<string>(PER_STORE_GROUPS)

/**
 * Whether `href` is the nav item that should read as active for `pathname`.
 *
 * Boundary-aware on purpose. A plain `pathname.startsWith(href)` also matches a
 * SIBLING whose slug merely extends this one — on `/admin/collections/products-archive`
 * it lights `products` too — because it compares characters, not path segments.
 * A match must be the whole path or continue at a `/`.
 *
 * No two collection slugs collide today (`gift-cards` / `gift-card-transactions`
 * misses by one character), so this guards the boundary rather than fixing a
 * live bug. It must still match document routes (`/admin/collections/orders/42`),
 * which is what `startsWith` was there for.
 */
export function isActiveNavPath(pathname: string, href: string): boolean {
  if (pathname === href) return true
  // A trailing slash is the same route, not a child of it.
  if (pathname === `${href}/`) return true
  return pathname.startsWith(`${href}/`)
}

export function buildNavModel(input: {
  collections: NavCollectionInput[]
  isPlatformApex: boolean
  badges?: Record<string, number>
}): NavGroup[] {
  const { collections, isPlatformApex, badges = {} } = input
  const order: string[] = []
  const byGroup = new Map<string, NavItem[]>()

  for (const c of collections) {
    if (c.hidden || !c.group) continue
    if (isPlatformApex && PER_STORE.has(c.group)) continue
    if (!byGroup.has(c.group)) {
      byGroup.set(c.group, [])
      order.push(c.group)
    }
    byGroup.get(c.group)!.push({
      slug: c.slug,
      label: c.label,
      href: `/admin/collections/${c.slug}`,
      ...(badges[c.slug] != null ? { badge: badges[c.slug] } : {}),
    })
  }

  return order.map((label) => ({ label, items: byGroup.get(label)! }))
}
