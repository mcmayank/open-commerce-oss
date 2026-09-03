/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AdminNavClient } from './AdminNav.client'

// Reassigned per test: active-state is a function of the pathname, so pinning
// it to one value only ever exercised the matching branch.
let mockPath = '/admin/collections/orders'

beforeEach(() => {
  mockPath = '/admin/collections/orders'
})

afterEach(cleanup)
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))
vi.mock('@payloadcms/ui', () => ({
  useConfig: () => ({
    config: {
      collections: [
        { slug: 'orders', labels: { plural: 'Orders' }, admin: { group: 'Orders' } },
        { slug: 'products', labels: { plural: 'Products' }, admin: { group: 'Catalog' } },
        // Deliberately shares a prefix with 'products' — guards the active-match
        // boundary. No two real slugs collide today; this fixture is what keeps
        // that from mattering when one eventually does.
        { slug: 'products-archive', labels: { plural: 'Products Archive' }, admin: { group: 'Catalog' } },
        { slug: 'secret', labels: { plural: 'Secret' }, admin: { group: 'Catalog', hidden: true } },
      ],
    },
  }),
  useNav: () => ({ navOpen: false, setNavOpen: () => {}, navRef: { current: null } }),
  // AdminNavClient renders the real AdminNavExtras, which calls useAuth(). A
  // null user takes the non-platform branch and renders (the mocked) TenantNavLinks.
  useAuth: () => ({ user: null }),
}))
vi.mock('@/components/admin/nav/TenantNavLinks', () => ({
  TenantNavLinks: () => <div data-testid="tenant-nav-links" />,
}))

const baseProps = {
  store: { name: 'Salt & Dough', plan: 'Grow', status: 'live' as const },
  userId: 'u1', userName: 'Mariam', userRole: 'Owner',
  badges: { orders: 7 }, isPlatformApex: false, isHostBound: true,
}

describe('AdminNavClient', () => {
  it('renders one section per config group and skips hidden collections', () => {
    render(<AdminNavClient {...baseProps} />)
    // Scoped to the group-label element: the fixture's "orders" collection has
    // plural label "Orders" under group "Orders" too, so an unscoped
    // getByText('Orders') ambiguously matches both the group heading and the
    // nav item text (RTL's getByText only ever matches an element's own direct
    // text-node children, so the heading and the link are two distinct
    // matches — not a false positive from partial-text matching).
    expect(screen.getByText('Orders', { selector: '.nb-shell-nav__group-label' })).toBeTruthy()
    expect(screen.getByText('Catalog', { selector: '.nb-shell-nav__group-label' })).toBeTruthy()
    expect(screen.queryByText('Secret')).toBeNull()
  })

  it('marks the active item from the pathname, and ONLY that item', () => {
    render(<AdminNavClient {...baseProps} />)
    const active = screen.getByText('Orders', { selector: 'a' }).closest('a')!
    expect(active.className).toContain('is-active')

    // The original assertion alone would pass even if every item were active —
    // it never checked that anything was NOT active.
    const inactive = screen.getByText('Products', { selector: 'a' }).closest('a')!
    expect(inactive.className).not.toContain('is-active')
    expect(document.querySelectorAll('a.is-active').length).toBe(1)
  })

  it('shows the store chip and badge count', () => {
    render(<AdminNavClient {...baseProps} />)
    expect(screen.getByText('Salt & Dough')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
  })

  it('renders a suspended store distinctly from live/draft — danger, not the live dot', () => {
    const { container } = render(
      <AdminNavClient
        {...baseProps}
        store={{ name: 'Salt & Dough', plan: 'Grow', status: 'suspended' }}
      />,
    )
    expect(screen.getByText(/suspended/i)).toBeTruthy()
    expect(container.querySelector('.nb-shell-nav__store-dot')).toBeNull()
    expect(container.querySelector('.nb-shell-nav__store-dot--danger')).toBeTruthy()
  })

  it('renders the tenant nav links (absorbed afterNavLinks)', () => {
    render(<AdminNavClient {...baseProps} />)
    expect(screen.getByTestId('tenant-nav-links')).toBeTruthy()
  })

  it('toggles collapse on button click', () => {
    render(<AdminNavClient {...baseProps} />)
    const root = screen.getByRole('navigation')
    expect(root.className).not.toContain('is-collapsed')
    fireEvent.click(screen.getByRole('button', { name: /collapse/i }))
    expect(root.className).toContain('is-collapsed')
  })
})

describe('AdminNavClient — active state across routes', () => {
  it('keeps the collection active while inside one of its documents', () => {
    // `pathname.startsWith(href)` is what makes a document route keep its
    // parent lit. Without it, opening an order would leave the rail with
    // nothing selected.
    mockPath = '/admin/collections/orders/6812'
    render(<AdminNavClient {...baseProps} />)

    const active = screen.getByText('Orders', { selector: 'a' }).closest('a')!
    expect(active.className).toContain('is-active')
    expect(document.querySelectorAll('a.is-active').length).toBe(1)
  })

  it('moves the active mark when the route moves to another collection', () => {
    mockPath = '/admin/collections/products'
    render(<AdminNavClient {...baseProps} />)

    expect(screen.getByText('Products', { selector: 'a' }).closest('a')!.className).toContain('is-active')
    expect(screen.getByText('Orders', { selector: 'a' }).closest('a')!.className).not.toContain('is-active')
  })

  it('marks Dashboard active at the admin root, and nothing else', () => {
    mockPath = '/admin'
    render(<AdminNavClient {...baseProps} />)

    const dashboard = screen.getByText('Dashboard', { selector: 'a' }).closest('a')!
    expect(dashboard.className).toContain('is-active')
    expect(document.querySelectorAll('a.is-active').length).toBe(1)
  })

  it('does not mark Dashboard active on a collection route', () => {
    // Dashboard matches on exact equality while items use startsWith, so a
    // regression to startsWith here would light Dashboard up on every page.
    mockPath = '/admin/collections/orders'
    render(<AdminNavClient {...baseProps} />)

    const dashboard = screen.getByText('Dashboard', { selector: 'a' }).closest('a')!
    expect(dashboard.className).not.toContain('is-active')
  })

  it('leaves every item unmarked on an admin route outside the nav model', () => {
    mockPath = '/admin/account'
    render(<AdminNavClient {...baseProps} />)

    expect(document.querySelectorAll('a.is-active').length).toBe(0)
  })
})

describe('AdminNavClient — active match respects path boundaries', () => {
  it('does not light a collection whose slug is a prefix of the current one', () => {
    mockPath = '/admin/collections/products-archive'
    render(<AdminNavClient {...baseProps} />)

    const archive = screen.getByText('Products Archive', { selector: 'a' }).closest('a')!
    const products = screen.getByText('Products', { selector: 'a' }).closest('a')!

    expect(archive.className).toContain('is-active')
    expect(products.className).not.toContain('is-active')
    expect(document.querySelectorAll('a.is-active').length).toBe(1)
  })

  it('still lights the shorter collection on its own route', () => {
    mockPath = '/admin/collections/products'
    render(<AdminNavClient {...baseProps} />)

    expect(screen.getByText('Products', { selector: 'a' }).closest('a')!.className).toContain('is-active')
    expect(screen.getByText('Products Archive', { selector: 'a' }).closest('a')!.className).not.toContain('is-active')
  })

  it('still lights the parent inside a document route', () => {
    // The boundary fix must not break the behaviour startsWith was there for.
    mockPath = '/admin/collections/products/42'
    render(<AdminNavClient {...baseProps} />)

    expect(screen.getByText('Products', { selector: 'a' }).closest('a')!.className).toContain('is-active')
    expect(document.querySelectorAll('a.is-active').length).toBe(1)
  })
})

