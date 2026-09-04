'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NiblrMark from './NiblrMark'

// Shared nav for both root layouts (landing `/` and every (platform) interior
// page). Slim top level — the three product pages — plus one Resources
// disclosure for the reading surfaces. Homepage sections are reachable by
// scrolling the homepage itself; anchors left the nav when it went site-wide.
const PRODUCT_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/templates', label: 'Templates' },
  { href: '/pricing', label: 'Pricing' },
] as const

const RESOURCE_LINKS = [
  { href: '/docs', label: 'Docs', desc: 'Guides and reference' },
  { href: '/blog', label: 'Blog', desc: 'Notes from the build' },
  { href: '/changelog', label: 'Changelog', desc: 'What shipped, dated' },
  { href: '/about', label: 'About', desc: 'Who makes Niblr' },
] as const

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function SiteNav() {
  const pathname = usePathname() ?? ''
  const [menuOpen, setMenuOpen] = useState(false)
  const [ddOpen, setDdOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  const resourcesActive = RESOURCE_LINKS.some((l) => isActive(pathname, l.href))

  // Close both menus on route change. Done during render rather than in an
  // effect — React's documented way to reset state when a value changes. An
  // effect paints one frame with the menu still open over the new page.
  const [openFor, setOpenFor] = useState(pathname)
  if (openFor !== pathname) {
    setOpenFor(pathname)
    setDdOpen(false)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!ddOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDdOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ddOpen])

  return (
    <nav>
      <div className="wrap nav-inner">
        <Link className="nav-logo" href="/">
          <NiblrMark className="mark" />
          <span className="text">niblr</span>
        </Link>

        <div className="nav-links">
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(pathname, link.href) ? 'active' : undefined}
              aria-current={isActive(pathname, link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}

          <div
            className="nav-dd"
            ref={ddRef}
            onMouseEnter={() => setDdOpen(true)}
            onMouseLeave={() => setDdOpen(false)}
            onBlur={(e) => {
              if (!ddRef.current?.contains(e.relatedTarget as Node)) setDdOpen(false)
            }}
          >
            <button
              type="button"
              className={`nav-dd-trigger${resourcesActive ? ' active' : ''}`}
              aria-expanded={ddOpen}
              aria-haspopup="true"
              onClick={() => setDdOpen((v) => !v)}
            >
              Resources
              <svg className="chev" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {ddOpen && (
              <div className="nav-dd-panel">
                {RESOURCE_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setDdOpen(false)}>
                    <span className="name">{link.label}</span>
                    <span className="desc">{link.desc}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="nav-actions">
          {/* Hairline separating browsing (links) from acting (account entry
              points) — the nav's two halves. */}
          <span className="nav-divide" aria-hidden="true" />
          <Link className="nav-signin" href="/admin">
            Sign in
          </Link>
          <Link className="btn btn-primary btn-sm nav-cta" href="/signup">
            Open your store
          </Link>
          {/* Below 940px `.nav-links` is display:none — this disclosure
              button + panel is that fallback. Plain client toggle, no
              portal/library, closes itself on link click. */}
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {menuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="nav-mobile-panel">
          <span className="group-label">Product</span>
          {PRODUCT_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          <span className="group-label">Resources</span>
          {RESOURCE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link href="/admin" onClick={() => setMenuOpen(false)}>
            Sign in
          </Link>
          <Link className="btn btn-primary btn-sm" href="/signup" onClick={() => setMenuOpen(false)}>
            Open your store
          </Link>
        </div>
      )}
    </nav>
  )
}
