import React from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { formatBytes } from '@/lib/format-bytes'
import { entitlementsById } from '@/entitlements'
import { storeWhere, storeIdOf } from '@/store-scope'

/**
 * Read-only usage readout for the tenant admin. Rendered as a `ui` field on
 * StoreSettings. `req`-scoped tenant is inferred from the settings doc's tenant.
 */
export default async function UsageMeter({ data }: { data?: { tenant?: number | { id: number } } }) {
  const tenantId = storeIdOf(data)
  if (!tenantId) return null

  const payload = await getPayload({ config })
  const [limits, products] = await Promise.all([
    entitlementsById(payload, tenantId),
    payload.count({ collection: 'products', where: storeWhere(tenantId), overrideAccess: true }),
  ])
  const used = limits.usage.mediaBytesUsed

  const row = (label: string, value: string, over: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span>{label}</span>
      <strong style={{ color: over ? '#b91c1c' : undefined }}>{value}</strong>
    </div>
  )

  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 4, padding: 12, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Plan usage — {limits.label}</div>
      {row('Products', `${products.totalDocs} / ${limits.maxProducts}`, products.totalDocs >= limits.maxProducts)}
      {row('Media storage', `${formatBytes(used)} / ${formatBytes(limits.maxStorageBytes)}`, used >= limits.maxStorageBytes)}
      {limits.canUpgrade && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          {/* Links, because for months this told merchants to upgrade with no
              upgrade anywhere to click. */}
          <a href="/admin/settings/plan">Upgrade to Growth</a> for higher limits.
        </div>
      )}
    </div>
  )
}
