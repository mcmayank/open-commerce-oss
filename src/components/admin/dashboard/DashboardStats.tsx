import type { TenantDashboardData } from '@/lib/tenant-metrics'
import { formatMoney } from '@/lib/money'
import { StatGrid, StatTile, type StatTrend } from '@/components/admin/brand/ui'

/**
 * Builds a comparative trend line, or nothing at all.
 *
 * Returns undefined when both periods are empty: with no prior activity there
 * is no honest comparison to draw, and inventing "▲ 0%" is exactly the kind of
 * fabricated figure the spec forbids. `noun` is always the SINGULAR form; this
 * function owns pluralisation, based on `delta` — the number actually shown —
 * not on `current`.
 */
function trendFor(current: number, previous: number, noun: string): StatTrend | undefined {
  if (current === 0 && previous === 0) return undefined
  if (current === previous) return { label: `Same as last week`, direction: 'flat' }
  const up = current > previous
  const delta = Math.abs(current - previous)
  return {
    label: `${up ? '▲' : '▼'} ${delta} ${noun}${delta === 1 ? '' : 's'} vs last week`,
    direction: up ? 'up' : 'down',
  }
}

/**
 * Same three-branch shape as `trendFor`, but for a money amount held in
 * integer minor units. Equal-but-non-zero periods must land on 'flat', never
 * on 'up' — a zero delta rendered as growth is the fabricated figure the
 * global rule forbids. No division, no `toFixed`, no percentages: `formatMoney`
 * does all the presentation and the arithmetic here stays integer minor units.
 */
function moneyTrendFor(current: number, previous: number, currency: string): StatTrend | undefined {
  if (current === 0 && previous === 0) return undefined
  if (current === previous) return { label: `Same as last week`, direction: 'flat' }
  const up = current > previous
  return {
    label: `${up ? '▲' : '▼'} ${formatMoney(Math.abs(current - previous), currency)} vs last week`,
    direction: up ? 'up' : 'down',
  }
}

/**
 * The four headline metrics. A figure that cannot be meaningful yet is dimmed
 * rather than shown at full weight — four bright zeros is what made the old
 * dashboard read as dead.
 */
export function DashboardStats({ metrics: m }: { metrics: TenantDashboardData }) {
  const { current, previous } = m.periods

  return (
    <StatGrid>
      <StatTile
        label="Paid orders"
        value={String(m.paidOrderCount)}
        muted={m.paidOrderCount === 0}
        trend={trendFor(current.count, previous.count, 'order')}
        meta={m.pendingOrderCount > 0 ? `${m.pendingOrderCount} awaiting fulfilment` : undefined}
      />
      <StatTile
        label="Revenue"
        value={formatMoney(m.revenueMinor, m.currency)}
        muted={m.revenueMinor === 0}
        trend={moneyTrendFor(current.revenueMinor, previous.revenueMinor, m.currency)}
      />
      <StatTile
        label="Products"
        value={String(m.productCount)}
        muted={m.productCount === 0}
        meta={m.lowStockCount > 0 ? `${m.lowStockCount} low on stock` : undefined}
      />
      <StatTile
        label="Customers"
        value={String(m.customerCount)}
        muted={m.customerCount === 0}
      />
    </StatGrid>
  )
}
