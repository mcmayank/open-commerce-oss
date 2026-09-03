'use client'
import * as React from 'react'
import Link from 'next/link'
import '@/components/admin/brand/admin-brand.css'
import './tenant-nav-links.css'
import { EXTRA_SETUP_LINKS } from '@/admin-links-overlay'

/**
 * Appended after Payload's nav groups (admin.components.afterNavLinks). Surfaces
 * the custom Payments and Voice route views — neither is a collection, so they
 * cannot appear in the nav groups — plus a shortcut to the live storefront. Each
 * view guards its own access, so no role gate is needed here.
 */
export function TenantNavLinks() {
  return (
    <nav className="nb-navlinks" aria-label="Store setup">
      <div className="nb-navlinks__label">Store setup</div>
      <Link className="nb-navlink" href="/admin/settings/payments">
        <span className="nb-navlink__icon" aria-hidden>
          ▦
        </span>
        Payments
      </Link>
      {/* Hosted-only links (Plan, Voice assistant) come through the seam; the
          single-store build has no plans and nothing to pay for. */}
      {EXTRA_SETUP_LINKS.map((link) => (
        <Link key={link.href} className="nb-navlink" href={link.href}>
          <span className="nb-navlink__icon" aria-hidden>
            {link.icon}
          </span>
          {link.label}
        </Link>
      ))}
      <a className="nb-navlink" href="/" target="_blank" rel="noreferrer">
        <span className="nb-navlink__icon" aria-hidden>
          ↗
        </span>
        View live store
      </a>
    </nav>
  )
}
