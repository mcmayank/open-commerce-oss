import type { ReactNode } from 'react'
import '../admin-brand.css'

/**
 * Section lead-in: brand eyebrow + display-face title, with optional subtitle
 * and a right-aligned action slot.
 */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="nb-section__head">
      <div>
        {eyebrow ? <p className="nb-section__eyebrow">{eyebrow}</p> : null}
        <h2 className="nb-section__title">{title}</h2>
        {sub ? <p className="nb-section__sub">{sub}</p> : null}
      </div>
      {action ?? null}
    </div>
  )
}
