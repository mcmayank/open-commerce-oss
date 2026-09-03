import type { ReactNode } from 'react'
import '../admin-brand.css'

type Tone = 'brand' | 'positive' | 'warning' | 'danger' | 'neutral'

/** Compact status pill. `dot` prefixes a filled indicator in the current tone. */
export function Badge({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span className={`nb-badge nb-badge--${tone}`}>
      {dot ? <span className="nb-badge__dot" /> : null}
      {children}
    </span>
  )
}
