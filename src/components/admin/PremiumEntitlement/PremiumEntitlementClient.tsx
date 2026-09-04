'use client'
import React from 'react'

/**
 * The tenant's Premium entitlements, one flag per gated capability. These are
 * deliberately kept as separate booleans rather than a single "isPremium" bit:
 * premiumSections, customCss and customSections don't all flip together on
 * every plan (see the plan limits in src/lib/plans.ts), but they gate unrelated
 * things and could diverge further on a future plan. Conflating them would
 * silently grant or deny the wrong capability the day they do.
 *
 * `customSections` mirrors the `customSections` entitlement `blockAvailable`
 * (src/mcp/blocks.ts) checks server-side for the `customSection` block — added
 * so the page-builder's BlockLibrary (Task 7) can lock that block client-side
 * instead of offering a block that will 403 at save time.
 */
export interface PremiumEntitlements {
  premiumSections: boolean
  customCss: boolean
  customSections: boolean
}

/**
 * Fail-closed default: a field rendered outside PremiumEntitlementClient (e.g.
 * in a test with no provider) reads every entitlement as `false` — locked —
 * exactly as a single `boolean` context defaulting to `false` did before this
 * was widened.
 */
const DEFAULT_ENTITLEMENTS: PremiumEntitlements = {
  premiumSections: false,
  customCss: false,
  customSections: false,
}

const PremiumEntitlementContext = React.createContext<PremiumEntitlements>(DEFAULT_ENTITLEMENTS)

export const usePremiumEntitlement = (): PremiumEntitlements => React.useContext(PremiumEntitlementContext)

export const PremiumEntitlementClient = ({
  premiumSections,
  customCss,
  customSections,
  children,
}: {
  premiumSections: boolean
  customCss: boolean
  customSections: boolean
  children: React.ReactNode
}) => (
  <PremiumEntitlementContext.Provider value={{ premiumSections, customCss, customSections }}>
    {children}
  </PremiumEntitlementContext.Provider>
)
