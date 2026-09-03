import { describe, expect, it } from 'vitest'
import type { TenantDashboardData } from '@/lib/tenant-metrics'
import { resolveNextAction } from './next-action'

const completeOnboarding = {
  hasProduct: true,
  hasGateway: true,
  hasStoreSettings: true,
  hasBranding: true,
  hasDomain: true,
  isLive: true,
}

const metrics = (over: Partial<TenantDashboardData> = {}): TenantDashboardData => ({
  currency: 'AED',
  paidOrderCount: 0,
  revenueMinor: 0,
  productCount: 1,
  customerCount: 0,
  pendingOrderCount: 0,
  recentOrders: [],
  onboarding: { ...completeOnboarding },
  lowStockCount: 0,
  hasEverHadOrder: false,
  periods: { current: { count: 0, revenueMinor: 0 }, previous: { count: 0, revenueMinor: 0 } },
  ...over,
})

describe('resolveNextAction', () => {
  it('state 1: names the first incomplete setup step and shows the rail', () => {
    const action = resolveNextAction(
      metrics({ onboarding: { ...completeOnboarding, hasGateway: false } }),
    )
    expect(action.key).toBe('setup')
    expect(action.title).toBe('Connect a payment gateway')
    expect(action.ctaHref).toBe('/admin/settings/payments')
    expect(action.showSetupRail).toBe(true)
  })

  it('state 2: reports orders awaiting fulfilment', () => {
    const action = resolveNextAction(metrics({ pendingOrderCount: 3, hasEverHadOrder: true }))
    expect(action.key).toBe('fulfil')
    expect(action.title).toContain('3')
    expect(action.showSetupRail).toBe(false)
  })

  it('state 2: never promises a bulk fulfil action that does not exist', () => {
    const action = resolveNextAction(metrics({ pendingOrderCount: 2, hasEverHadOrder: true }))
    expect(action.ctaLabel).toBe('View orders to fulfil')
    expect(action.ctaLabel.toLowerCase()).not.toMatch(/^fulfil/)
  })

  it('state 2: singularises a single order', () => {
    const one = resolveNextAction(metrics({ pendingOrderCount: 1, hasEverHadOrder: true }))
    const many = resolveNextAction(metrics({ pendingOrderCount: 2, hasEverHadOrder: true }))
    expect(one.title).toContain('1 order is')
    expect(many.title).toContain('2 orders are')
  })

  it('state 3: prompts for a first sale when set up but never sold', () => {
    const action = resolveNextAction(metrics({ hasEverHadOrder: false }))
    expect(action.key).toBe('first-sale')
    expect(action.showSetupRail).toBe(false)
  })

  it('state 3: offers the secondary "add another product" action; other states do not', () => {
    const firstSale = resolveNextAction(metrics({ hasEverHadOrder: false }))
    expect(firstSale.secondaryLabel).toBe('Add another product')
    expect(firstSale.secondaryHref).toBe('/admin/collections/products/create')

    const fulfil = resolveNextAction(metrics({ pendingOrderCount: 1, hasEverHadOrder: true }))
    expect(fulfil.secondaryLabel).toBeUndefined()
    expect(fulfil.secondaryHref).toBeUndefined()
  })

  it('state 4: reports low stock once selling has started', () => {
    const action = resolveNextAction(
      metrics({ hasEverHadOrder: true, lowStockCount: 2, paidOrderCount: 5 }),
    )
    expect(action.key).toBe('low-stock')
    expect(action.title).toContain('2')
  })

  it('state 4: singularises a single low-stock product', () => {
    const one = resolveNextAction(
      metrics({ hasEverHadOrder: true, lowStockCount: 1, paidOrderCount: 5 }),
    )
    const many = resolveNextAction(
      metrics({ hasEverHadOrder: true, lowStockCount: 2, paidOrderCount: 5 }),
    )
    expect(one.title).toContain('1 product is')
    expect(many.title).toContain('2 products are')
  })

  it('state 5: rests when nothing needs attention', () => {
    const action = resolveNextAction(
      metrics({
        hasEverHadOrder: true,
        paidOrderCount: 5,
        periods: {
          current: { count: 2, revenueMinor: 5000 },
          previous: { count: 1, revenueMinor: 2000 },
        },
      }),
    )
    expect(action.key).toBe('healthy')
    expect(action.showSetupRail).toBe(false)
  })

  it('state 5: singularises a single paid order in the resting state', () => {
    const one = resolveNextAction(
      metrics({
        hasEverHadOrder: true,
        paidOrderCount: 5,
        periods: {
          current: { count: 1, revenueMinor: 2000 },
          previous: { count: 1, revenueMinor: 2000 },
        },
      }),
    )
    const many = resolveNextAction(
      metrics({
        hasEverHadOrder: true,
        paidOrderCount: 5,
        periods: {
          current: { count: 2, revenueMinor: 5000 },
          previous: { count: 1, revenueMinor: 2000 },
        },
      }),
    )
    expect(one.body).toContain('1 paid order in')
    expect(many.body).toContain('2 paid orders in')
  })

  it('priority: setup outranks pending fulfilment', () => {
    const withIncompleteSetup = resolveNextAction(
      metrics({
        onboarding: { ...completeOnboarding, hasDomain: false },
        pendingOrderCount: 4,
        hasEverHadOrder: true,
      }),
    )
    const withSetupComplete = resolveNextAction(
      metrics({
        onboarding: { ...completeOnboarding },
        pendingOrderCount: 4,
        hasEverHadOrder: true,
      }),
    )
    expect(withIncompleteSetup.key).toBe('setup')
    // Removing the only unfinished setup step, with everything else held
    // constant, must flip the result down to the next rung.
    expect(withSetupComplete.key).toBe('fulfil')
  })

  it('priority: fulfilment outranks low stock', () => {
    const withPendingOrder = resolveNextAction(
      metrics({ pendingOrderCount: 1, lowStockCount: 9, hasEverHadOrder: true }),
    )
    const withoutPendingOrder = resolveNextAction(
      metrics({ pendingOrderCount: 0, lowStockCount: 9, hasEverHadOrder: true }),
    )
    expect(withPendingOrder.key).toBe('fulfil')
    // Removing the pending order, with everything else held constant, must
    // flip the result down to the next rung.
    expect(withoutPendingOrder.key).toBe('low-stock')
  })

  it('priority: first sale outranks low stock', () => {
    const beforeFirstSale = resolveNextAction(
      metrics({ hasEverHadOrder: false, lowStockCount: 3 }),
    )
    const afterFirstSale = resolveNextAction(metrics({ hasEverHadOrder: true, lowStockCount: 3 }))
    expect(beforeFirstSale.key).toBe('first-sale')
    // Flipping hasEverHadOrder, with everything else held constant, must flip
    // the result down to the next rung.
    expect(afterFirstSale.key).toBe('low-stock')
  })

  it('offers both catalog shortcuts only on the first setup step', () => {
    const first = resolveNextAction(
      metrics({ onboarding: { ...completeOnboarding, hasProduct: false } }),
    )
    const second = resolveNextAction(
      metrics({ onboarding: { ...completeOnboarding, hasGateway: false } }),
    )
    expect(first.showSeedSamples).toBe(true)
    expect(first.showImportStore).toBe(true)
    expect(second.showSeedSamples).toBe(false)
    expect(second.showImportStore).toBe(false)
  })

  it('opens the storefront in a new tab only for the first-sale CTA', () => {
    const firstSale = resolveNextAction(metrics({ hasEverHadOrder: false }))
    expect(firstSale.ctaTarget).toBe('_blank')

    const fulfil = resolveNextAction(metrics({ pendingOrderCount: 1, hasEverHadOrder: true }))
    expect(fulfil.ctaTarget).toBeUndefined()
  })

  it('never offers the catalog shortcuts outside setup', () => {
    const fulfil = resolveNextAction(metrics({ pendingOrderCount: 1, hasEverHadOrder: true }))
    expect(fulfil.showImportStore).toBe(false)
    expect(fulfil.showSeedSamples).toBe(false)
  })

  it('never implies Niblr saves the card-processing rate', () => {
    const keys: Partial<TenantDashboardData>[] = [
      { onboarding: { ...completeOnboarding, hasGateway: false } },
      { pendingOrderCount: 1, hasEverHadOrder: true },
      { hasEverHadOrder: false },
      { hasEverHadOrder: true, lowStockCount: 1 },
      { hasEverHadOrder: true },
    ]
    for (const over of keys) {
      const copy = Object.values(resolveNextAction(metrics(over))).join(' ').toLowerCase()
      expect(copy).not.toContain('100% of every sale')
      expect(copy).not.toContain('0.029')
      expect(copy).not.toContain('telr')
    }
  })
})
