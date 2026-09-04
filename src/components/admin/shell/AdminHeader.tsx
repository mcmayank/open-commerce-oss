'use client'
import * as React from 'react'
import './shell.css'
import { useConfig, useNav, useTheme } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'

/**
 * `admin.components.header` — bespoke header for the Phase 0 admin shell.
 *
 * Breadcrumb (collection-level only — document-title crumbs are a later
 * phase), `⌘K` search trigger, theme toggle (reuses Payload's own
 * `useTheme`, so persistence rides Payload's existing mechanism), and a
 * notifications trigger. Search/notifications open stubs in Phase 0 — they
 * are `aria-haspopup` buttons, not full features yet.
 *
 * Purely presentational + client hooks: no server data fetching here.
 *
 * `.nb-shell-header__nav-toggle` is the phone-width nav-open control. The
 * nav (`AdminNav.client.tsx`) becomes a fixed drawer at <=900px, opened by
 * setting `useNav().navOpen` true — Payload's own `.app-header`/`#nav-toggler`
 * carried that control natively, but this bespoke header hides both, so below
 * that breakpoint this button is the only way to open the drawer. `shell.css`
 * hides it above 900px to match the nav's own drawer breakpoint exactly.
 */
export function AdminHeader(): React.JSX.Element {
  const { config } = useConfig()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { setNavOpen } = useNav()

  const crumb = React.useMemo(() => breadcrumbFor(pathname, config), [pathname, config])

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <header className="nb-shell-header">
      <div className="nb-shell-header__crumbs" aria-label="Breadcrumb">
        <button
          type="button"
          className="nb-shell-header__icon-btn nb-shell-header__nav-toggle"
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="nb-shell-header__crumb nb-shell-header__crumb--current">{crumb}</span>
      </div>

      <div className="nb-shell-header__actions">
        <button
          type="button"
          className="nb-shell-header__search"
          aria-label="Search"
          aria-haspopup="dialog"
        >
          <span aria-hidden>⌘K</span>
          <span className="nb-shell-header__search-label">Search</span>
        </button>

        <button
          type="button"
          className="nb-shell-header__icon-btn"
          aria-label="Notifications"
          aria-haspopup="dialog"
        >
          <span aria-hidden>🔔</span>
        </button>

        <button
          type="button"
          className="nb-shell-header__icon-btn"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={toggleTheme}
        >
          <span aria-hidden>{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>
    </header>
  )
}

/**
 * Collection-level breadcrumb from the pathname. `/admin` → "Dashboard";
 * `/admin/collections/:slug` → that collection's `labels.plural` (falls
 * back to the raw slug if the config lookup misses). Anything deeper still
 * resolves off the `:slug` segment — document-title crumbs land later.
 */
/**
 * What the breadcrumb needs from a collection. `plural` is `unknown` rather than
 * `string` because Payload types it as StaticLabel — a string OR a per-locale
 * record. Returning that record straight into JSX renders "[object Object]",
 * which the previous `any` hid; the narrowing below falls back to the slug.
 */
type CrumbCollection = { slug?: string; labels?: { plural?: unknown } }

function breadcrumbFor(pathname: string, config: { collections?: CrumbCollection[] }): string {
  if (pathname === '/admin' || pathname === '/admin/') return 'Dashboard'

  const match = pathname.match(/^\/admin\/collections\/([^/]+)/)
  if (match) {
    const slug = match[1]
    const collection = (config.collections ?? []).find((c) => c.slug === slug)
    const plural = collection?.labels?.plural
    return typeof plural === 'string' ? plural : slug
  }

  return 'Dashboard'
}
