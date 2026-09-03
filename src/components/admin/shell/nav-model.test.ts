import { describe, it, expect } from 'vitest'
import { buildNavModel, isActiveNavPath } from './nav-model'

const cols = [
  { slug: 'orders', label: 'Orders', group: 'Orders' },
  { slug: 'products', label: 'Products', group: 'Catalog' },
  { slug: 'categories', label: 'Categories', group: 'Catalog' },
  { slug: 'customers', label: 'Customers', group: 'Customers' },
  { slug: 'users', label: 'Team', group: 'Settings' },
  { slug: 'secrets', label: 'Secrets', group: 'Settings', hidden: true },
  { slug: 'loose', label: 'Loose' }, // no group → dropped
]

describe('buildNavModel', () => {
  it('groups by NAV_GROUPS value, preserving first-seen group order', () => {
    const groups = buildNavModel({ collections: cols, isPlatformApex: false })
    expect(groups.map((g) => g.label)).toEqual(['Orders', 'Catalog', 'Customers', 'Settings'])
    expect(groups[1].items.map((i) => i.slug)).toEqual(['products', 'categories'])
  })

  it('drops hidden entities and entities with no group', () => {
    const groups = buildNavModel({ collections: cols, isPlatformApex: false })
    const settings = groups.find((g) => g.label === 'Settings')!
    expect(settings.items.map((i) => i.slug)).toEqual(['users']) // no "secrets", no "loose"
  })

  it('computes collection list hrefs', () => {
    const groups = buildNavModel({ collections: cols, isPlatformApex: false })
    expect(groups[0].items[0].href).toBe('/admin/collections/orders')
  })

  it('hides PER_STORE_GROUPS on the platform apex', () => {
    const groups = buildNavModel({ collections: cols, isPlatformApex: true })
    // Orders, Catalog, Customers are per-store → gone; Settings remains
    expect(groups.map((g) => g.label)).toEqual(['Settings'])
  })

  it('attaches badges by slug', () => {
    const groups = buildNavModel({ collections: cols, isPlatformApex: false, badges: { orders: 7 } })
    expect(groups[0].items[0].badge).toBe(7)
  })
})

describe('isActiveNavPath', () => {
  it('matches a route exactly', () => {
    expect(isActiveNavPath('/admin/collections/products', '/admin/collections/products')).toBe(true)
  })

  it('matches a document route beneath the collection', () => {
    expect(isActiveNavPath('/admin/collections/products/42', '/admin/collections/products')).toBe(true)
    expect(isActiveNavPath('/admin/collections/products/create', '/admin/collections/products')).toBe(true)
  })

  it('does NOT match a sibling whose slug merely extends this one', () => {
    // The reason this exists: plain startsWith lights both `products` and
    // `products-archive` when you are on the latter. No two real slugs collide
    // today — `gift-cards` / `gift-card-transactions` misses by one character —
    // so this guards a boundary rather than fixing a live bug.
    expect(isActiveNavPath('/admin/collections/products-archive', '/admin/collections/products')).toBe(false)
    expect(isActiveNavPath('/admin/collections/gift-card-transactions', '/admin/collections/gift-cards')).toBe(false)
  })

  it('does not match an unrelated route', () => {
    expect(isActiveNavPath('/admin/account', '/admin/collections/products')).toBe(false)
    expect(isActiveNavPath('/admin', '/admin/collections/products')).toBe(false)
  })

  it('tolerates a trailing slash on the current path', () => {
    expect(isActiveNavPath('/admin/collections/products/', '/admin/collections/products')).toBe(true)
  })
})
