import Link from 'next/link'
import React from 'react'
import { getCurrentCustomer } from '@/lib/auth/session'
import { CartButton } from './cart/CartButton'
import { logoSizeClass, resolveHeaderLayout } from '@/themes/layout'
import { mediaSrcSet } from '@/lib/image'
import type { HeaderLayout } from '@/themes/layout'
import type { Media, StoreSetting } from '@/payload-types'

interface HeaderProps {
  storeName: string
  settings?: StoreSetting | null
  /** Theme-driven layout variant (Slice D). Defaults to the standard header. */
  layout?: HeaderLayout
}

const navLinkClass =
  'px-1 py-1 text-sm tracking-[0.08em] text-(--color-text) hover:opacity-60 transition-opacity'
const cartClass =
  'px-2 py-1 text-sm font-medium uppercase tracking-[0.14em] text-(--color-primary) hover:opacity-70 transition-opacity'

type NavItem = { label: string; href: string }

/** Tenant-configured nav links, or the sensible defaults when none are set. */
function resolveNav(settings: StoreSetting | null | undefined, signedIn: boolean): NavItem[] {
  const custom = (settings?.navLinks ?? []).filter(
    (l): l is NonNullable<StoreSetting['navLinks']>[number] => Boolean(l?.label && l?.href),
  )
  if (custom.length > 0) return custom.map((l) => ({ label: l.label, href: l.href }))
  return [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: signedIn ? 'Account' : 'Sign in', href: signedIn ? '/account' : '/account/login' },
  ]
}

export default async function Header({ storeName, settings, layout = 'standard' }: HeaderProps) {
  const logo = settings?.logo && typeof settings.logo === 'object' ? (settings.logo as Media) : null
  const signedIn = Boolean(await getCurrentCustomer())
  const nav = resolveNav(settings, signedIn)
  const announcement = settings?.announcement?.trim() || null

  // The `layout` prop is the theme default; a tenant setting can override it.
  const headerLayout = resolveHeaderLayout(layout, settings?.headerLayout)

  const brand = (
    <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
      {logo?.url ? (
        <img
          src={logo.url}
          srcSet={mediaSrcSet(logo)}
          sizes="200px"
          alt={logo.alt ?? storeName}
          className={logoSizeClass(settings?.logoSize)}
        />
      ) : (
        <span
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}
        >
          {storeName}
        </span>
      )}
    </Link>
  )

  const navItems = nav.map((item) => (
    <Link key={`${item.href}-${item.label}`} href={item.href} className={navLinkClass}>
      {item.label}
    </Link>
  ))

  // Thin announcement strip above the header (scrolls away; the header sticks).
  const announcementBar = announcement ? (
    <div
      className="px-4 py-2.5 text-center text-[11px] uppercase tracking-[0.22em]"
      style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}
    >
      {announcement}
    </div>
  ) : null

  const headerClass =
    'sticky top-0 z-50 border-b border-(--color-border) bg-(--color-surface)/92 backdrop-blur-sm'

  // Editorial: single row — logo left, nav centered, outlined "Bag" pill right.
  if (headerLayout === 'editorial') {
    return (
      <>
        {announcementBar}
        <header className={headerClass}>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            {brand}
            <nav className="hidden flex-1 items-center justify-center gap-x-8 sm:flex">{navItems}</nav>
            <CartButton className="inline-flex shrink-0 items-center gap-2 rounded-(--radius-button) border border-(--color-primary) px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-(--color-primary) hover:opacity-70 transition-opacity" />
          </div>
        </header>
      </>
    )
  }

  // Centered masthead: brand on top, nav centered beneath a hairline.
  if (headerLayout === 'centered') {
    return (
      <>
        {announcementBar}
        <header className={headerClass}>
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex justify-center">{brand}</div>
            <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-1 border-t border-(--color-border) pt-2">
              {navItems}
              <CartButton className={cartClass} />
            </nav>
          </div>
        </header>
      </>
    )
  }

  // Standard: brand left, nav right.
  return (
    <>
      {announcementBar}
      <header className={headerClass}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {brand}
          <nav className="flex items-center gap-x-8">
            {navItems}
            <CartButton className={cartClass} />
          </nav>
        </div>
      </header>
    </>
  )
}
