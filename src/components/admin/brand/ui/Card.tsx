import type { ReactNode } from 'react'
import '../admin-brand.css'

/**
 * Surface card for the tenant dashboard. Optional head (title + action) sits on
 * an elevated bar; body padding collapses with `flush` for edge-to-edge content
 * such as tables.
 */
export function Card({
  title,
  action,
  flush = false,
  children,
}: {
  title?: ReactNode
  action?: ReactNode
  flush?: boolean
  children: ReactNode
}) {
  return (
    <div className={flush ? 'nb-card nb-card--flush' : 'nb-card'}>
      {(title || action) && (
        <div className="nb-card__head">
          {title ? <h3>{title}</h3> : <span />}
          {action ?? null}
        </div>
      )}
      <div className="nb-card__body">{children}</div>
    </div>
  )
}
