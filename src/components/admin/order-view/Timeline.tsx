import React from 'react'
import { timelineRows } from './derive'
import type { OrderDoc } from './types'

export interface TimelineProps {
  order: OrderDoc
}

/**
 * Vertical timeline listing order events (invoice, payment, placed).
 * Renders nothing when there are no events.
 */
export function Timeline({ order }: TimelineProps) {
  const rows = timelineRows(order)
  if (rows.length === 0) return null

  return (
    <div className="ov-card">
      <div className="ov-card__head">
        <h3>Timeline</h3>
      </div>
      <div className="ov-card__body">
        <ul className="ov-tl">
          {rows.map((row) => {
            const when = new Date(row.when).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
            return (
              <li key={row.key} className="ov-tl__item">
                <strong>{row.title}</strong>
                {row.detail ? <span> · {row.detail}</span> : null}
                <div className="ov-tl__when">{when}</div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
