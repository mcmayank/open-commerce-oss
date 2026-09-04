'use client'
import * as React from 'react'
import Link from 'next/link'
import './shell.css'
import '@/components/admin/brand/admin-brand.css'
import { useConfig, useNav } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import { buildNavModel, isActiveNavPath, type NavCollectionInput } from './nav-model'
import { useNavCollapse } from './useNavCollapse'
import { AdminNavExtras } from '@/components/admin/nav/AdminNavExtras'

export type StoreChip = { name: string; plan: string; status: 'live' | 'draft' | 'suspended' }
export type AdminNavClientProps = {
  store: StoreChip | null
  userId: string
  userName: string
  userRole: string
  badges: Record<string, number>
  isPlatformApex: boolean
  isHostBound: boolean
}

/** First letters of up to two words — used for the store/user avatar chips. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

/**
 * Per-slug leading icons for the nav rail. Stroke-based, lucide/Payload-ish
 * paths on a 24×24 grid, rendered at ~18px via `.nb-shell-nav__icon`. Keyed
 * by collection slug (plus a synthetic "dashboard" key for the top link) so
 * every real collection in the config maps to something recognizable when
 * the rail collapses to icons-only and labels disappear. Unmapped slugs
 * fall back to DEFAULT_ICON_PATHS rather than rendering nothing.
 *
 * `currentColor` throughout — no literal colors — so each icon inherits the
 * item's themed text color (muted/hover/active) for free.
 */
const NAV_ICON_PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  orders: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  invoices: (
    <>
      <path d="M7 2h7l5 5v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M14 2v5h5" />
      <path d="M9 12h6M9 15.5h6M9 19h3" />
    </>
  ),
  products: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  categories: (
    <>
      <path d="M12.59 2.59 21 11l-9 9-8.41-8.41A2 2 0 0 1 3 10.17V4a1 1 0 0 1 1-1h6.17a2 2 0 0 1 1.42.59Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  'discount-codes': (
    <>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  'import-jobs': (
    <>
      <path d="M12 3v11" />
      <path d="M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4.5 20h15" />
    </>
  ),
  'gift-cards': (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1.25" />
      <path d="M3 12.5h18" />
      <path d="M12 8v13" />
      <path d="M12 8c-1.25-4-6-4.5-6-1.5S9.5 8 12 8Z" />
      <path d="M12 8c1.25-4 6-4.5 6-1.5S14.5 8 12 8Z" />
    </>
  ),
  'gift-card-transactions': (
    <>
      <path d="M17 2.5 21 6.5 17 10.5" />
      <path d="M3 11.5v-2a4 4 0 0 1 4-4h14" />
      <path d="M7 21.5 3 17.5 7 13.5" />
      <path d="M21 12.5v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  customers: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </>
  ),
  campaigns: (
    <>
      <path d="M3 10.5v3a1 1 0 0 0 1 1h2l6.5 3.5v-12L6 9.5H4a1 1 0 0 0-1 1Z" />
      <path d="M17 9a3 3 0 0 1 0 6" />
      <path d="M6 14.5V18a1 1 0 0 0 1 1h1" />
    </>
  ),
  contacts: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 17c0-2 2-3 4-3s4 1 4 3" />
    </>
  ),
  'marketing-configs': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  pages: (
    <>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16.5 15.5 11 4 21" />
    </>
  ),
  'store-settings': (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3" />
      <path d="M3 8l1 3a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0l1-3" />
      <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  domains: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15.3 15.3 0 0 1 0 18a15.3 15.3 0 0 1 0-18Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.5 21c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
      <path d="M16 8.5a3 3 0 1 0 0-6" />
      <path d="M15 15.5c2.8.4 5 2.2 5 5.5" />
    </>
  ),
}

const DEFAULT_ICON_PATHS: React.ReactNode = (
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 12h8" />
  </>
)

/** Leading icon for a nav item, keyed by collection slug (or "dashboard"). */
function NavIcon({ slug }: { slug: string }) {
  return (
    <svg
      className="nb-shell-nav__icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {NAV_ICON_PATHS[slug] ?? DEFAULT_ICON_PATHS}
    </svg>
  )
}

/**
 * Bespoke left-rail nav for the Phase 0 admin shell. Renders the config-derived
 * nav model (Task 1) as groups of links, tracks active state from the pathname,
 * supports collapse-to-rail (Task 2) and a mobile drawer via Payload's `useNav`,
 * and appends `AdminNavExtras` — which owns the platform/tenant split and the
 * `html[data-platform-nav]` contract — rather than a bare `TenantNavLinks`.
 */
export function AdminNavClient(props: AdminNavClientProps) {
  const { store, userId, userName, userRole, badges, isPlatformApex, isHostBound } = props
  const { config } = useConfig()
  const pathname = usePathname()
  const { navOpen, navRef } = useNav()
  const { collapsed, toggle } = useNavCollapse(userId)

  const collections: NavCollectionInput[] = React.useMemo(
    () =>
      (config.collections ?? []).map((c: any) => ({
        slug: c.slug,
        label: c.labels?.plural ?? c.slug,
        group: c.admin?.group,
        hidden: c.admin?.hidden === true,
      })),
    [config.collections],
  )

  const groups = React.useMemo(
    () => buildNavModel({ collections, isPlatformApex, badges }),
    [collections, isPlatformApex, badges],
  )

  const rootClass = [
    'nb-shell-nav',
    collapsed ? 'is-collapsed' : '',
    navOpen ? 'is-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <nav
      ref={navRef}
      className={rootClass}
      aria-label="Primary"
      data-host-bound={isHostBound}
      data-platform-nav={isPlatformApex ? '' : undefined}
    >
      <div className="nb-shell-nav__brand">
        <span className="nb-shell-nav__brandmark" aria-hidden>
          N
        </span>
        <span className="nb-shell-nav__wordmark">Niblr</span>
        <button
          type="button"
          className="nb-shell-nav__collapse"
          aria-label="Collapse navigation"
          onClick={toggle}
        >
          <span aria-hidden>☰</span>
        </button>
      </div>

      {store && (
        <div className="nb-shell-nav__store" data-host-bound={isHostBound}>
          <span className="nb-shell-nav__store-avatar" aria-hidden>
            {initials(store.name)}
          </span>
          <span className="nb-shell-nav__store-meta">
            <span className="nb-shell-nav__store-name">{store.name}</span>
            <span className="nb-shell-nav__store-plan">
              {store.status === 'live' && <span className="nb-shell-nav__store-dot" aria-hidden />}
              {store.status === 'suspended' && (
                <span className="nb-shell-nav__store-dot--danger" aria-hidden />
              )}
              {store.plan}
              {store.status === 'live' && ' · live'}
              {store.status === 'draft' && ' · draft'}
              {store.status === 'suspended' && (
                <span className="nb-shell-nav__store-status--danger"> · suspended</span>
              )}
            </span>
          </span>
        </div>
      )}

      <div className="nb-shell-nav__scroll">
        {/* Exact equality, deliberately NOT isActiveNavPath: `/admin` is a
            prefix of every other admin route, so any boundary-aware or
            startsWith match would light Dashboard on every page. The asymmetry
            with the items below is the point — see AdminNav.client.test.tsx. */}
        <Link
          href="/admin"
          className={'nb-shell-nav__item' + (pathname === '/admin' ? ' is-active' : '')}
        >
          <NavIcon slug="dashboard" />
          Dashboard
        </Link>

        {groups.map((g) => (
          <div key={g.label} className="nb-shell-nav__group">
            <div className="nb-shell-nav__group-label">{g.label}</div>
            {g.items.map((it) => (
              <Link
                key={it.slug}
                href={it.href}
                className={
                  'nb-shell-nav__item' + (isActiveNavPath(pathname, it.href) ? ' is-active' : '')
                }
              >
                <NavIcon slug={it.slug} />
                {it.label}
                {it.badge != null && <span className="nb-shell-nav__badge">{it.badge}</span>}
              </Link>
            ))}
          </div>
        ))}

        <AdminNavExtras />
      </div>

      <div className="nb-shell-nav__user">
        <Link href="/admin/account" className="nb-shell-nav__user-link">
          <span className="nb-shell-nav__avatar" aria-hidden>
            {initials(userName)}
          </span>
          <span className="nb-shell-nav__user-meta">
            <span className="nb-shell-nav__user-name">{userName}</span>
            <span className="nb-shell-nav__user-role">{userRole}</span>
          </span>
        </Link>
        <Link href="/admin/logout" className="nb-shell-nav__logout" aria-label="Log out">
          <span aria-hidden>⏻</span>
        </Link>
      </div>
    </nav>
  )
}
