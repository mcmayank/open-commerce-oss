'use client'
import * as React from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { HAS_PLATFORM_ADMIN } from '@/admin-links-overlay'
import { TenantNavLinks } from './TenantNavLinks'
import '@/components/admin/brand/admin-brand.css'
import './tenant-nav-links.css'

/** True when the admin is being viewed on the platform apex (not a store subdomain). */
function isRootHost(): boolean {
  if (typeof window === 'undefined') return false
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000').split(':')[0]
  const h = window.location.hostname
  return h === root || h === `www.${root}`
}

/**
 * Host- and role-aware nav additions (admin.components.afterNavLinks):
 * - On the platform apex, a super-admin gets a "Platform" section (operator
 *   overview) and we set `html[data-platform-nav]` so CSS can hide the per-store
 *   content collections — this is the platform-operator view.
 * - On a store subdomain (a store owner, or a super-admin drilled into a store),
 *   the store-setup links show and nothing is hidden.
 *
 * `admin.hidden` can't do the host split (it only receives `user`), which is why
 * the store-content collections are hidden via this client-set attribute + CSS.
 */
export function AdminNavExtras() {
  const { user } = useAuth()
  const superAdmin = Boolean((user as { roles?: string[] } | null)?.roles?.includes('super-admin'))
  const [rootHost, setRootHost] = React.useState(false)

  React.useEffect(() => {
    // Read the host on the client only. Doing it in an effect (rather than a
    // lazy initializer) keeps the first render matching SSR (false), avoiding a
    // hydration mismatch, then updates once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRootHost(isRootHost())
  }, [])

  const platformMode = HAS_PLATFORM_ADMIN && superAdmin && rootHost

  React.useEffect(() => {
    const el = document.documentElement
    if (platformMode) el.setAttribute('data-platform-nav', '1')
    else el.removeAttribute('data-platform-nav')
    return () => el.removeAttribute('data-platform-nav')
  }, [platformMode])

  if (platformMode) {
    return (
      <nav className="nb-navlinks" aria-label="Platform">
        <div className="nb-navlinks__label">Platform</div>
        <Link className="nb-navlink" href="/admin/platform">
          <span className="nb-navlink__icon" aria-hidden>
            ◧
          </span>
          Operator overview
        </Link>
      </nav>
    )
  }

  // On a store subdomain (or before host is resolved), show the store-setup links.
  return <TenantNavLinks />
}
