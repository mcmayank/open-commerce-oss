import type { ReactNode } from 'react'
import '../admin-brand.css'

/** Responsive 4-up grid of stat tiles (collapses to 2-up, then 1-up). */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="nb-stat-grid">{children}</div>
}

export type StatTrend = {
  label: ReactNode
  direction: 'up' | 'down' | 'flat'
}

/**
 * A single headline metric: uppercase label, display-face value, optional meta.
 * `muted` dims a figure that is not yet meaningful (four bright zeros on a new
 * store is what made the old dashboard read as dead). `trend` renders a small
 * comparative line beneath the value.
 */
export function StatTile({
  label,
  value,
  meta,
  trend,
  muted = false,
}: {
  label: ReactNode
  value: ReactNode
  meta?: ReactNode
  trend?: StatTrend
  muted?: boolean
}) {
  const trendCls =
    trend?.direction === 'up'
      ? 'nb-stat__trend nb-stat__trend--up'
      : trend?.direction === 'down'
        ? 'nb-stat__trend nb-stat__trend--down'
        : 'nb-stat__trend'

  return (
    <div className={muted ? 'nb-stat nb-stat--muted' : 'nb-stat'}>
      <div className="nb-stat__label">{label}</div>
      <div className="nb-stat__value">{value}</div>
      {meta ? <div className="nb-stat__meta">{meta}</div> : null}
      {trend ? <div className={trendCls}>{trend.label}</div> : null}
    </div>
  )
}
