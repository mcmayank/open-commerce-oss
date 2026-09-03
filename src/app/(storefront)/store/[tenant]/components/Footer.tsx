import React from 'react'
import type { FooterLayout } from '@/themes/layout'

interface FooterProps {
  storeName: string
  /** Theme-driven layout variant (Slice D). Defaults to the standard footer. */
  layout?: FooterLayout
  /**
   * Whether to render "Powered by Niblr". Resolve it with
   * `showsNiblrBranding(store)` from `@/lib/branding`.
   *
   * REQUIRED ON PURPOSE — no default. An optional prop is how the tenth
   * storefront page ships silently unbranded a year from now; a required one
   * makes that a type error at the call site.
   */
  showBranding: boolean
}

export default function Footer({ storeName, layout = 'standard', showBranding }: FooterProps) {
  const year = new Date().getFullYear()
  const brand = <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{storeName}</span>
  const poweredBy = (
    <p className="text-xs" style={{ color: 'var(--color-accent)' }}>
      Powered by Niblr
    </p>
  )

  // Minimal: a single centered line.
  if (layout === 'minimal') {
    return (
      <footer className="mt-auto border-t border-(--color-border) bg-(--color-surface-alt)">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-(--color-text-muted) sm:px-6 lg:px-8">
          &copy; {year} {brand}
          {showBranding && <div className="mt-1">{poweredBy}</div>}
        </div>
      </footer>
    )
  }

  return (
    <footer className="mt-auto border-t border-(--color-border) bg-(--color-surface-alt)">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-(--color-text-muted)">
            &copy; {year} {brand}. All rights reserved.
          </p>
          {showBranding && poweredBy}
        </div>
      </div>
    </footer>
  )
}
