import React from 'react'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { storeForHost } from '@/store-loader'
import { entitlementsForHost } from '@/entitlements'
import { isSuperAdmin, type TenantsArrayUser } from '@/access/roles'
import { PremiumEntitlementClient } from './PremiumEntitlementClient'

/**
 * Resolves the host-bound tenant's Premium entitlements (premium layout
 * sections, custom CSS, and custom sections — independent flags, see
 * PremiumEntitlements) ONCE per admin page load and provides them through
 * context. A single page can render many variant pickers plus the custom CSS
 * field and the block library; without this, each would need its own lookup.
 *
 * Only a super-admin on a host with no store (the platform apex, where
 * save-time enforcement already exempts super-admins) is treated as entitled —
 * locking their UI would be misleading. Every other outcome fails CLOSED
 * (locked): a store host whose plan lookup fails, and a host that names no
 * store for anyone else, both end as not-entitled. A wrongly-locked picker/field is recoverable with a
 * reload; wrongly unlocking would let a Starter tenant build a whole page (or
 * write CSS) and only discover the block at save time, losing their work.
 */
export const PremiumEntitlementProvider = async ({ children }: { children: React.ReactNode }) => {
  const h = await nextHeaders()
  const store = await storeForHost(h)

  let premiumSections = false
  let customCss = false
  let customSections = false
  const payload = await getPayload({ config })
  if (!store) {
    try {
      const { user } = await payload.auth({ headers: h })
      const entitled = isSuperAdmin(user as TenantsArrayUser | null)
      premiumSections = entitled
      customCss = entitled
      customSections = entitled
    } catch {
      // Not signed in, or auth failed: locked.
    }
  } else {
    try {
      const limits = await entitlementsForHost(payload, h.get('host'))
      premiumSections = limits?.premiumSections ?? false
      customCss = limits?.customCss ?? false
      customSections = limits?.customSections ?? false
    } catch {
      premiumSections = false
      customCss = false
      customSections = false
    }
  }

  return (
    <PremiumEntitlementClient
      premiumSections={premiumSections}
      customCss={customCss}
      customSections={customSections}
    >
      {children}
    </PremiumEntitlementClient>
  )
}
