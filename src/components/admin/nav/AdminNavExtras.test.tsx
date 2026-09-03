// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@payloadcms/ui', () => ({ useAuth: () => ({ user: { roles: ['super-admin'] } }) }))
vi.mock('./TenantNavLinks', () => ({ TenantNavLinks: () => <div data-testid="tenant-nav-links" /> }))
// The seam the single-store build ships: no platform admin at all.
vi.mock('@/admin-links-overlay', () => ({ HAS_PLATFORM_ADMIN: false, EXTRA_SETUP_LINKS: [] }))

describe('AdminNavExtras without a platform admin', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN
    document.documentElement.removeAttribute('data-platform-nav')
    vi.resetModules()
  })

  it('never shows the Platform nav even for a super-admin on the root host', async () => {
    // jsdom's default test URL hostname is "localhost". Pin NEXT_PUBLIC_ROOT_DOMAIN
    // to match it so `isRootHost()` genuinely resolves true (isolating the
    // assertion to the HAS_PLATFORM_ADMIN guard, rather than accidentally passing
    // because rootHost never becomes true against the un-mocked env default).
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000'
    vi.resetModules()
    const { AdminNavExtras } = await import('./AdminNavExtras')
    render(<AdminNavExtras />)
    expect(await screen.findByTestId('tenant-nav-links')).toBeTruthy()
    expect(screen.queryByText('Operator overview')).toBeNull()
    expect(document.documentElement.getAttribute('data-platform-nav')).toBeNull()
  })
})
