import { APIError, type Payload } from 'payload'
import { isSuperAdmin, type TenantsArrayUser } from '@/access/roles'
import { layoutUsesPremium } from '@/blocks/premium'
import { findNewCustomSections } from '@/blocks/custom-section-diff'
import { findNewPremiumVariants, type LayoutBlock } from '@/blocks/premium-diff'
import { formatBytes } from './format-bytes'
import { entitlementsById } from '@/entitlements'
import { storeWhere } from '@/store-scope'

/** Enforce limits only for real store users — never for system/seed or super-admin. The single-store build's entitlements grant everything anyway. */
export function isEnforced(req: { user?: unknown }): boolean {
  const user = req.user as TenantsArrayUser | null | undefined
  if (!user) return false
  if (isSuperAdmin(user)) return false
  return true
}

export async function assertProductQuota(payload: Payload, tenantId: string | number): Promise<void> {
  const ent = await entitlementsById(payload, tenantId)
  const { totalDocs } = await payload.count({
    collection: 'products',
    where: storeWhere(tenantId),
    overrideAccess: true,
  })
  if (totalDocs >= ent.maxProducts) {
    throw new APIError(
      `Your ${ent.label} plan is limited to ${ent.maxProducts} products. ` +
        (ent.canUpgrade ? 'Upgrade to Growth in Settings → Plan to add more.' : 'Contact support to raise your limit.'),
      403,
    )
  }
}

export async function assertStorageQuota(
  payload: Payload,
  tenantId: string | number,
  incomingBytes: number,
): Promise<void> {
  const ent = await entitlementsById(payload, tenantId)
  const used = ent.usage.mediaBytesUsed
  const { maxStorageBytes } = ent
  if (used + incomingBytes > maxStorageBytes) {
    throw new APIError(
      `Your ${ent.label} plan includes ${formatBytes(maxStorageBytes)} of media storage ` +
        `(you've used ${formatBytes(used)}). ` +
        (ent.canUpgrade ? 'Upgrade to Growth in Settings → Plan for more.' : 'Contact support to raise your limit.'),
      403,
    )
  }
}

export async function assertPremiumSections(
  payload: Payload,
  tenantId: string | number,
  layout: LayoutBlock[] | null | undefined,
  originalLayout?: LayoutBlock[] | null,
): Promise<void> {
  // layoutUsesPremium predates the nullable `variant` field on LayoutBlock; it only
  // reads `blockType`, so the shape is compatible — cast to bridge the two types
  // without touching that pre-existing, intentionally-unmodified function.
  const usesPremiumBlock = layoutUsesPremium(layout as { blockType?: string }[] | null | undefined)
  const newVariants = findNewPremiumVariants(layout, originalLayout)
  // Cheap exit before touching the DB — most saves involve nothing premium.
  if (!usesPremiumBlock && newVariants.length === 0) return

  if ((await entitlementsById(payload, tenantId)).premiumSections) return

  if (usesPremiumBlock) {
    throw new APIError('Premium sections require the Growth plan. Upgrade in Settings → Plan.', 403)
  }

  const first = newVariants[0]
  throw new APIError(
    `The “${first.variant}” layout is a Premium design. ` +
      'Upgrade to Growth in Settings → Plan to use it, or pick one of the standard layouts.',
    403,
  )
}

/**
 * Custom CSS is Premium. Enforced on *change* only: a downgraded store keeps its
 * appearance and stays editable, consistent with the render-time reasoning at
 * src/blocks/index.tsx:74. Clearing the value is always allowed so a merchant is
 * never locked into CSS they can no longer edit.
 */
export async function assertCustomCss(
  payload: Payload,
  tenantId: string | number,
  css: string | null | undefined,
  originalCss: string | null | undefined,
): Promise<void> {
  const next = (css ?? '').trim()
  const prev = (originalCss ?? '').trim()
  if (next === prev || next === '') return

  if ((await entitlementsById(payload, tenantId)).customCss) return

  throw new APIError('Custom CSS requires the Growth plan. Upgrade to use it.', 403)
}

/**
 * Custom sections are Premium. Enforced on *change* only: a downgraded store keeps
 * its pages rendering and stays able to edit and remove what it already has,
 * consistent with assertCustomCss above and with the render-time reasoning at
 * src/blocks/index.tsx. `customSection` is deliberately NOT in PREMIUM_BLOCK_TYPES,
 * because that set is checked at render and would strip sections from live pages
 * the moment entitlement lapsed.
 */
export async function assertCustomSections(
  payload: Payload,
  tenantId: string | number,
  layout: LayoutBlock[] | null | undefined,
  originalLayout?: LayoutBlock[] | null,
): Promise<void> {
  // Cheap exit before touching the DB — most saves add no custom section.
  if (findNewCustomSections(layout, originalLayout) === 0) return

  if ((await entitlementsById(payload, tenantId)).customSections) return

  throw new APIError('Custom sections require the Growth plan. Upgrade to use them.', 403)
}

/**
 * Gate on creating a section definition. Create only — a downgraded merchant must
 * stay able to edit and delete definitions they already own, the same reasoning
 * that lets assertCustomCss always permit clearing.
 */
export async function assertCustomSectionDefinition(
  payload: Payload,
  tenantId: string | number,
): Promise<void> {
  if ((await entitlementsById(payload, tenantId)).customSections) return

  throw new APIError('Custom sections require the Growth plan. Upgrade to create one.', 403)
}

/**
 * Custom domains are a Starter capability — the first gate whose upgrade target
 * is Starter rather than Growth.
 *
 * Enforced on CREATE and on an UPDATE that changes `hostname`. An existing,
 * untouched domain keeps resolving and keeps routing however the tenant's plan
 * changes, consistent with assertCustomCss and assertCustomSections above:
 * gating a domain at routing would take a live storefront offline the moment a
 * card was declined.
 *
 * `tenantId` is optional and an absent one throws. A domain that cannot be
 * attributed to a tenant is one whose entitlement cannot be checked, so the
 * only safe direction is closed.
 */
export async function assertCustomDomain(
  payload: Payload,
  tenantId: string | number | undefined,
): Promise<void> {
  const denied = new APIError(
    'Custom domains require the Starter plan. Upgrade in Settings → Plan to add one.',
    403,
  )
  if (tenantId === undefined) throw denied

  // This gate was inert through EARLY_ACCESS_ENDS_AT until 9 Aug 2026, and the
  // reason it no longer is matters more than the removal.
  //
  // The bypass existed because signup skipped Checkout during early access, so
  // NO hosted merchant could reach Starter. Enforcing then would have made
  // custom domains unobtainable for everyone — including the people who chose
  // Starter precisely for "your own domain, your brand" — which inverts the
  // branch's purpose.
  //
  // Card-at-signup removed that premise. A merchant reaches Starter in a
  // minute, from signup or Settings → Plan. Keeping the bypass would hand
  // Starter's headline feature to Free tenants while Starter merchants pay for
  // it, which is the opposite failure and the more expensive one.
  //
  // Existing domains are untouched: Domains.ts only calls this on create or on
  // an update that CHANGES the hostname, so a domain added while the gate was
  // inert keeps resolving, and one still pending can still finish verifying —
  // verification writes `status`, never `hostname`.
  if ((await entitlementsById(payload, tenantId)).customDomains) return

  throw denied
}

/**
 * Selling gift cards is a Growth capability. REDEEMING one is not gated, and
 * must never be: a card already in a customer's hands keeps working if the
 * merchant downgrades, the same reasoning that stops a live custom domain going
 * dark when a card declines. The customer is not a party to the merchant's
 * billing state.
 *
 * Called ONLY when a gift-card product is created or when `issuesGiftCard` is
 * turned on — the transition, never the steady state. An existing gift-card
 * product keeps working through a downgrade, the same way an existing custom
 * domain keeps resolving.
 *
 * Deliberately NOT called at issue time in the payment handler. If a customer
 * has already paid for a gift card, it must be minted whatever the merchant's
 * plan says now: taking the money and issuing nothing is worse than either
 * gate, and the customer is not a party to the merchant's billing state.
 */
export async function assertGiftCardSale(
  payload: Payload,
  tenantId: string | number | undefined,
): Promise<void> {
  const denied = new APIError(
    'Selling gift cards requires the Growth plan. Upgrade in Settings → Plan.',
    403,
  )
  if (tenantId === undefined) throw denied
  if ((await entitlementsById(payload, tenantId)).giftCards) return
  throw denied
}

