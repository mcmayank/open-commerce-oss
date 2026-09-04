import React from 'react'
import Link from 'next/link'

const RADIUS_STYLE: React.CSSProperties = { borderRadius: 'var(--radius-button, 0.5rem)' }

type CtaLink = { label?: string | null; href?: string | null }

/** CTA pair; colors are passed in per-variant so contrast holds against each
 *  background. Module-level so it isn't re-created on every render. Adapted
 *  from SplitHeroCtas (src/blocks/SplitHero/Component.tsx) — same shape. */
export function HeroCtas({
  primary,
  secondary,
  primaryStyle,
  secondaryStyle,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
}: {
  primary: CtaLink
  secondary: CtaLink
  primaryStyle: React.CSSProperties
  secondaryStyle: React.CSSProperties
  className?: string
  /** Extra classes for the primary/secondary link — used to carry an explicit
   *  text color that isn't already the ambient color of its surroundings. */
  primaryClassName?: string
  secondaryClassName?: string
}) {
  if (!primary.label && !secondary.label) return null
  return (
    <div className={`mt-2 flex flex-wrap gap-3 ${className}`}>
      {primary.label && primary.href && (
        <Link
          href={primary.href}
          data-nb-part="cta"
          className={`inline-block px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${primaryClassName}`}
          style={{ ...RADIUS_STYLE, ...primaryStyle }}
        >
          {primary.label}
        </Link>
      )}
      {secondary.label && secondary.href && (
        <Link
          href={secondary.href}
          data-nb-part="cta"
          className={`inline-block border px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${secondaryClassName}`}
          style={{ ...RADIUS_STYLE, ...secondaryStyle }}
        >
          {secondary.label}
        </Link>
      )}
    </div>
  )
}
