/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AdminHeader } from './AdminHeader'

// `mockPath` and `mockTheme` are reassigned per test — the header's two
// interesting behaviours (breadcrumb resolution and the theme toggle) are both
// functions of them, and pinning either to one value tests one branch of many.
let mockPath = '/admin/collections/orders'
let mockTheme = 'dark'
const setTheme = vi.fn()
const setNavOpen = vi.fn()

vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))
vi.mock('@payloadcms/ui', () => ({
  usePathname: () => mockPath,
  useTheme: () => ({ theme: mockTheme, setTheme }),
  useNav: () => ({ setNavOpen }),
  useConfig: () => ({
    config: {
      collections: [
        { slug: 'orders', labels: { plural: 'Orders' } },
        { slug: 'gift-cards', labels: { plural: 'Gift Cards' } },
        // Payload types labels.plural as StaticLabel — a string OR a per-locale
        // record. The record form is legal config and must not reach JSX.
        { slug: 'i18n-coll', labels: { plural: { en: 'Localised', fr: 'Localisé' } } },
      ],
    },
  }),
}))

beforeEach(() => {
  mockPath = '/admin/collections/orders'
  mockTheme = 'dark'
})

afterEach(() => {
  cleanup()
  setTheme.mockReset()
  setNavOpen.mockReset()
})

function crumb(): string {
  return screen.getByText((_, el) =>
    el?.className === 'nb-shell-header__crumb nb-shell-header__crumb--current',
  ).textContent!
}

describe('AdminHeader', () => {
  it('shows the current collection as the breadcrumb', () => {
    render(<AdminHeader />)
    expect(screen.getByText('Orders')).toBeTruthy()
  })

  it('exposes a search trigger', () => {
    render(<AdminHeader />)
    expect(screen.getByRole('button', { name: /search/i })).toBeTruthy()
  })

  it('opens the nav drawer from the mobile nav-toggle button', () => {
    render(<AdminHeader />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(setNavOpen).toHaveBeenCalledWith(true)
  })
})

describe('AdminHeader — breadcrumb resolution', () => {
  it('reads "Dashboard" at the admin root', () => {
    mockPath = '/admin'
    render(<AdminHeader />)
    expect(crumb()).toBe('Dashboard')
  })

  it('reads "Dashboard" at the admin root with a trailing slash', () => {
    mockPath = '/admin/'
    render(<AdminHeader />)
    expect(crumb()).toBe('Dashboard')
  })

  it('resolves a collection slug to its plural label', () => {
    mockPath = '/admin/collections/gift-cards'
    render(<AdminHeader />)
    expect(crumb()).toBe('Gift Cards')
  })

  it('keeps the collection crumb on a document route, not the document id', () => {
    // Documented behaviour: document-title crumbs are a later phase, so a
    // deeper path still resolves off the :slug segment.
    mockPath = '/admin/collections/orders/6812'
    render(<AdminHeader />)
    expect(crumb()).toBe('Orders')
  })

  it('falls back to the raw slug when the config has no such collection', () => {
    mockPath = '/admin/collections/not-in-config'
    render(<AdminHeader />)
    expect(crumb()).toBe('not-in-config')
  })

  it('falls back to the slug when a label is a per-locale record, not a string', () => {
    // Returning the record straight into JSX renders "[object Object]".
    mockPath = '/admin/collections/i18n-coll'
    render(<AdminHeader />)
    expect(crumb()).toBe('i18n-coll')
  })

  it('reads "Dashboard" on a non-collection admin route', () => {
    mockPath = '/admin/account'
    render(<AdminHeader />)
    expect(crumb()).toBe('Dashboard')
  })
})

describe('AdminHeader — theme toggle', () => {
  it('switches dark to light, and labels the action by its destination', () => {
    mockTheme = 'dark'
    render(<AdminHeader />)
    const button = screen.getByRole('button', { name: /switch to light theme/i })
    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('switches light back to dark', () => {
    // The other direction was never covered: a toggle hardcoded to 'light'
    // would have passed the original suite.
    mockTheme = 'light'
    render(<AdminHeader />)
    const button = screen.getByRole('button', { name: /switch to dark theme/i })
    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})
