// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TenantDashboardData } from '@/lib/tenant-metrics'
import { formatMoney } from '@/lib/money'
import { DashboardStats } from './DashboardStats'

afterEach(cleanup)

const metrics = (over: Partial<TenantDashboardData> = {}): TenantDashboardData => ({
  currency: 'AED',
  paidOrderCount: 0,
  revenueMinor: 0,
  productCount: 0,
  customerCount: 0,
  pendingOrderCount: 0,
  recentOrders: [],
  onboarding: {
    hasProduct: false,
    hasGateway: false,
    hasStoreSettings: false,
    hasBranding: false,
    hasDomain: false,
    isLive: false,
  },
  lowStockCount: 0,
  hasEverHadOrder: false,
  periods: { current: { count: 0, revenueMinor: 0 }, previous: { count: 0, revenueMinor: 0 } },
  ...over,
})

describe('DashboardStats', () => {
  it('renders all four metrics', () => {
    const { container } = render(<DashboardStats metrics={metrics({ productCount: 10 })} />)
    expect(container.querySelectorAll('.nb-stat')).toHaveLength(4)
    expect(screen.getByText('10')).toBeTruthy()
  })

  it('dims a metric that is still zero and does not dim one that is not', () => {
    const { container } = render(
      <DashboardStats metrics={metrics({ productCount: 10, customerCount: 0 })} />,
    )
    const tiles = Array.from(container.querySelectorAll('.nb-stat'))
    const products = tiles.find((t) => t.textContent?.includes('Products'))
    const customers = tiles.find((t) => t.textContent?.includes('Customers'))

    // Guard presence first: a stale/renamed label would make `find` return
    // undefined, and the className assertions below would then pass vacuously.
    expect(products).toBeDefined()
    expect(customers).toBeDefined()
    expect(products?.className).not.toContain('nb-stat--muted')
    expect(customers?.className).toContain('nb-stat--muted')
  })

  it('shows an upward trend on both orders and revenue when this week beats last week', () => {
    const { container } = render(
      <DashboardStats
        metrics={metrics({
          paidOrderCount: 5,
          periods: {
            current: { count: 3, revenueMinor: 3000 },
            previous: { count: 1, revenueMinor: 1000 },
          },
        })}
      />,
    )
    // Exact counts, not just "greater than 0" — a test that only checks the
    // orders tile can pass even when the revenue tile's direction is wrong.
    expect(container.querySelectorAll('.nb-stat__trend--up')).toHaveLength(2)
    expect(container.querySelectorAll('.nb-stat__trend--down')).toHaveLength(0)
    // Pin formatMoney's actual output rather than assuming it.
    expect(container.textContent).toContain(`${formatMoney(2000, 'AED')} vs last week`)
  })

  it('shows a downward trend on both orders and revenue when this week is behind last week', () => {
    const { container } = render(
      <DashboardStats
        metrics={metrics({
          paidOrderCount: 5,
          periods: {
            current: { count: 1, revenueMinor: 1000 },
            previous: { count: 4, revenueMinor: 4000 },
          },
        })}
      />,
    )
    expect(container.querySelectorAll('.nb-stat__trend--down')).toHaveLength(2)
    expect(container.querySelectorAll('.nb-stat__trend--up')).toHaveLength(0)
    expect(container.textContent).toContain(`${formatMoney(3000, 'AED')} vs last week`)
  })

  it('renders no trend line at all when there is no prior activity to compare', () => {
    const { container } = render(<DashboardStats metrics={metrics()} />)
    expect(container.querySelectorAll('.nb-stat__trend')).toHaveLength(0)
  })

  it('treats equal-but-non-zero periods as flat, never as growth, for both orders and revenue', () => {
    const { container } = render(
      <DashboardStats
        metrics={metrics({
          paidOrderCount: 2,
          revenueMinor: 2000,
          periods: {
            current: { count: 2, revenueMinor: 2000 },
            previous: { count: 2, revenueMinor: 2000 },
          },
        })}
      />,
    )
    // This is the branch the Critical defect lived in: a non-zero equal
    // revenue period must never render as "up".
    expect(container.querySelectorAll('.nb-stat__trend--up')).toHaveLength(0)
    expect(container.querySelectorAll('.nb-stat__trend--down')).toHaveLength(0)
    // Both the orders and revenue trend lines are present and flat, not just
    // absent (presence guard so this can't pass vacuously).
    const flatTrends = container.querySelectorAll('.nb-stat__trend')
    expect(flatTrends).toHaveLength(2)
    flatTrends.forEach((el) => expect(el.textContent).toBe('Same as last week'))
  })

  it('pluralises the orders trend off the delta shown, not off the current count', () => {
    const { container: deltaOne } = render(
      <DashboardStats
        metrics={metrics({
          paidOrderCount: 2,
          periods: {
            current: { count: 3, revenueMinor: 0 },
            previous: { count: 2, revenueMinor: 0 },
          },
        })}
      />,
    )
    // delta = 1, even though current count (3) is not 1 — must read "1 order".
    expect(deltaOne.textContent).toContain('1 order vs last week')
    expect(deltaOne.textContent).not.toContain('1 orders vs last week')

    const { container: deltaThree } = render(
      <DashboardStats
        metrics={metrics({
          paidOrderCount: 2,
          periods: {
            current: { count: 1, revenueMinor: 0 },
            previous: { count: 4, revenueMinor: 0 },
          },
        })}
      />,
    )
    // delta = 3, current count is 1 — must still read "3 orders", not "3 order".
    expect(deltaThree.textContent).toContain('3 orders vs last week')
    expect(deltaThree.textContent).not.toContain('3 order vs last week')
  })

  it('shows a pending-fulfilment meta on the Paid orders tile when orders await fulfilment, and hides it when none do', () => {
    const { container: withPending } = render(
      <DashboardStats metrics={metrics({ pendingOrderCount: 3 })} />,
    )
    expect(withPending.textContent).toContain('3 awaiting fulfilment')

    const { container: withoutPending } = render(
      <DashboardStats metrics={metrics({ pendingOrderCount: 0 })} />,
    )
    expect(withoutPending.textContent).not.toContain('awaiting fulfilment')
  })

  it('reads the singular boundary correctly: "1 awaiting fulfilment", never "1 awaiting fulfilments"', () => {
    const { container } = render(<DashboardStats metrics={metrics({ pendingOrderCount: 1 })} />)
    expect(container.textContent).toContain('1 awaiting fulfilment')
    expect(container.textContent).not.toContain('1 awaiting fulfilments')
  })
})
