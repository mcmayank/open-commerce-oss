'use client'
import * as React from 'react'
import type { UIFieldClientComponent } from 'payload'
import '@/components/admin/brand/admin-brand.css'

/**
 * Proactive product-quota meter on the Products form. Shows how many products
 * the store has used against its plan limit BEFORE the merchant hits the
 * on-save 403 from assertProductQuota (src/lib/plan-enforcement.ts). Both the
 * plan and the count are fetched access-scoped to the tenant.
 */
const ProductQuotaNotice: UIFieldClientComponent = () => {
  const [ent, setEnt] = React.useState<{ maxProducts: number | null; label: string; canUpgrade: boolean } | null>(null)
  const [used, setUsed] = React.useState<number | null>(null)

  React.useEffect(() => {
    let active = true
    void Promise.all([
      fetch('/api/entitlements', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/products?limit=1&depth=0', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([entitlements, products]) => {
        if (!active) return
        if (entitlements && typeof entitlements.label === 'string') setEnt(entitlements)
        if (typeof products?.totalDocs === 'number') setUsed(products.totalDocs)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (ent === null || used === null) return null

  // null = unlimited (JSON cannot carry Infinity); an unlimited store needs no meter.
  if (ent.maxProducts === null) return null
  const { maxProducts } = ent
  const pct = Math.min(100, Math.round((used / maxProducts) * 100))
  const atLimit = used >= maxProducts
  const near = !atLimit && used / maxProducts >= 0.8

  const barColor = atLimit
    ? 'var(--theme-error-500, #d14343)'
    : near
      ? 'var(--theme-warning-500, #d97706)'
      : 'var(--nb-brand)'

  return (
    <div
      style={{
        border: `1px solid ${atLimit ? 'var(--theme-error-500, #d14343)' : 'var(--theme-elevation-150)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 20,
        background: atLimit ? 'var(--theme-error-100)' : 'var(--theme-elevation-0)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>Products used</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--theme-elevation-600)' }}>
          {used} / {maxProducts} · {ent.label} plan
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--theme-elevation-150)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 200ms ease' }} />
      </div>
      {atLimit && (
        <p style={{ fontSize: 13, margin: '8px 0 0', color: 'var(--theme-text)' }}>
          You&apos;ve reached your {ent.label} plan limit.{' '}
          {ent.canUpgrade ? (
            <a href="/admin/settings/plan">Upgrade to Growth to add more products.</a>
          ) : (
            'Contact support to raise it.'
          )}
        </p>
      )}
    </div>
  )
}

export default ProductQuotaNotice
