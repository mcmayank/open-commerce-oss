/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AdminNavClient } from './AdminNav.client'

/**
 * Parity guards for the bespoke left-rail nav (Task 3), proving it preserves
 * the three chrome behaviors the Payload-supplied nav used to give us for
 * free:
 *  - a host-bound store admin sees no tenant/store switcher
 *  - the platform apex hides per-store content sections (nav-groups.ts'
 *    PER_STORE_GROUPS) while keeping operator-relevant sections (Settings)
 *  - AdminNavExtras (the afterNavLinks replacement, owning the
 *    `html[data-platform-nav]` contract) is actually rendered, not dropped
 *    in the rewrite
 *
 * `nav-groups.test.ts` covers the CSS/data-table side of the platform-hiding
 * contract; this file covers the client component that consumes it.
 */

afterEach(cleanup)

vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }))
vi.mock('@payloadcms/ui', () => ({
  useConfig: () => ({
    config: {
      collections: [
        { slug: 'orders', labels: { plural: 'Orders' }, admin: { group: 'Orders' } },
        { slug: 'users', labels: { plural: 'Team' }, admin: { group: 'Settings' } },
      ],
    },
  }),
  useNav: () => ({ navOpen: false, setNavOpen: () => {}, navRef: { current: null } }),
  // AdminNavClient renders the real AdminNavExtras, which calls useAuth().
  // Without this, render throws (useAuth is undefined on the mocked module).
  useAuth: () => ({ user: null }),
}))
vi.mock('@/components/admin/nav/TenantNavLinks', () => ({
  TenantNavLinks: () => <div data-testid="tenant-nav-links" />,
}))

const baseProps = {
  store: { name: 'Salt & Dough', plan: 'Grow', status: 'live' as const },
  userId: 'u1',
  userName: 'Mariam',
  userRole: 'Owner',
  badges: {},
  isPlatformApex: false,
  isHostBound: true,
}

function props(overrides: Partial<typeof baseProps> = {}) {
  return { ...baseProps, ...overrides }
}

describe('AdminNavClient parity: host-bound selector hidden', () => {
  it('a host-bound store admin renders no tenant/store selector', () => {
    render(<AdminNavClient {...props({ isHostBound: true })} />)
    expect(screen.queryByTestId('tenant-selector')).toBeNull()
    expect(screen.getByRole('navigation').getAttribute('data-host-bound')).toBe('true')
  })

  it('comparative: a non-host-bound render flips the same attribute to "false"', () => {
    render(<AdminNavClient {...props({ isHostBound: false })} />)
    expect(screen.getByRole('navigation').getAttribute('data-host-bound')).toBe('false')
  })
})

describe('AdminNavClient parity: platform apex hides per-store groups', () => {
  it('hides a PER_STORE_GROUPS section (Orders) and keeps Settings', () => {
    render(<AdminNavClient {...props({ isPlatformApex: true })} />)
    expect(screen.queryByText('Orders', { selector: '.nb-shell-nav__group-label' })).toBeNull()
    expect(screen.getByText('Settings', { selector: '.nb-shell-nav__group-label' })).toBeTruthy()
    expect(screen.getByRole('navigation').getAttribute('data-platform-nav')).not.toBeNull()
  })

  it('comparative: off the platform apex, Orders is shown and the attribute is absent', () => {
    render(<AdminNavClient {...props({ isPlatformApex: false })} />)
    expect(screen.getByText('Orders', { selector: '.nb-shell-nav__group-label' })).toBeTruthy()
    expect(screen.getByRole('navigation').getAttribute('data-platform-nav')).toBeNull()
  })
})

describe('AdminNavClient parity: AdminNavExtras present', () => {
  it('renders AdminNavExtras (afterNavLinks replacement) inside the nav', () => {
    render(<AdminNavClient {...props()} />)
    expect(screen.getByTestId('tenant-nav-links')).toBeTruthy()
  })
})
