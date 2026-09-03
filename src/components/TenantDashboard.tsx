import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { isSuperAdmin, ownsTenant, type TenantsArrayUser } from '@/access/roles'
import { canExport } from '@/lib/export/auth'
import { getTenantMetrics } from '@/lib/tenant-metrics'
import { formatMoney } from '@/lib/money'
import { Badge, Button, Card, SectionHeader } from '@/components/admin/brand/ui'
import { resolveNextAction } from '@/lib/dashboard/next-action'
import { NextActionHero } from '@/components/admin/dashboard/NextActionHero'
import { DashboardStats } from '@/components/admin/dashboard/DashboardStats'
import { RemoveSampleContentCard } from '@/components/admin/dashboard/RemoveSampleContentCard'
import { ExportDataCard } from '@/components/admin/dashboard/ExportDataCard'
import { ImportStoreCard } from '@/components/admin/dashboard/ImportStoreCard'
import { sourceRegistry } from '@/imports/core/source-registry'
import type { SampleCounts } from '@/lib/sample-seed'

export type TenantDashboardProps = AdminViewServerProps & {
  tenantId: string | number
  tenantSlug: string
  /** Counts of flagged sample rows. The removal card renders only when there are any. */
  sampleCounts?: SampleCounts
}

/** Map an order status to a badge tone. */
function statusTone(status: string): 'positive' | 'danger' | 'warning' | 'neutral' {
  if (status === 'cancelled' || status === 'refunded') return 'danger'
  // `paid` reads as "Awaiting fulfilment" (see STATUS_LABELS) — the row that
  // needs the merchant's action, so it gets the warning tone, not a green
  // "all done" positive.
  if (status === 'paid') return 'warning'
  if (status === 'pending') return 'warning'
  return 'neutral'
}

/**
 * Display labels for order statuses. `paid` reads as "Awaiting fulfilment"
 * because that is what it means to the merchant — but it is a LABEL only.
 * The stored status values remain pending/paid/shipped/delivered/cancelled/refunded.
 */
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Awaiting fulfilment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export async function TenantDashboard({ initPageResult, tenantId, sampleCounts }: TenantDashboardProps) {
  const { payload, user } = initPageResult.req

  // Payload already wraps the dashboard view in DefaultTemplate (the nav/chrome),
  // so this view renders ONLY its inner content — a second DefaultTemplate would
  // duplicate the sidebar. (the platform dashboard differs: it's a custom /platform
  // path view, which renders raw and must supply its own DefaultTemplate.)
  const shell = (children: React.ReactNode) => <React.Fragment>{children}</React.Fragment>

  // ─── SECURITY GUARD (must be first) ───────────────────────────────────────
  const typedUser = user as TenantsArrayUser | null
  if (!typedUser || (!isSuperAdmin(typedUser) && !ownsTenant(typedUser, tenantId))) {
    return shell(
      <div className="nb-view">
        <SectionHeader eyebrow="Access" title="Not authorized" />
        <p>You don&apos;t have access to this store&apos;s dashboard.</p>
      </div>,
    )
  }
  // ─── END SECURITY GUARD ───────────────────────────────────────────────────

  const m = await getTenantMetrics(payload, tenantId)
  const nextAction = resolveNextAction(m)

  return shell(
    <div className="nb-view">
      <SectionHeader
        eyebrow="Your store"
        title="Dashboard"
        action={
          <Button href="/" target="_blank" rel="noreferrer">
            View live store ↗
          </Button>
        }
      />

      <div className="nb-stack">
        <NextActionHero action={nextAction} onboarding={m.onboarding} />

        <DashboardStats metrics={m} />

        {/* Recent orders */}
        <Card
          title="Recent orders"
          flush
          action={
            <Button href="/admin/collections/orders" variant="ghost" size="sm">
              View all
            </Button>
          }
        >
          {m.recentOrders.length === 0 ? (
            <div className="nb-empty">No orders yet. They&apos;ll appear here as customers check out.</div>
          ) : (
            <div className="nb-table-wrap">
              <table className="nb-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="nb-table__num">Total</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {m.recentOrders.map((o) => (
                    <tr key={String(o.id)}>
                      <td>
                        <code>{o.orderNumber}</code>
                      </td>
                      <td>{o.customerLabel}</td>
                      <td>
                        <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                      </td>
                      <td className="nb-table__num">{formatMoney(o.total ?? 0, m.currency)}</td>
                      <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/*
          Sample content removal — shown while ANY sample row survives, not just
          products. A merchant who bulk-deletes the seeded products in the admin
          list view still has the sample categories in their storefront nav and
          the sample media against their storage quota; gating on products alone
          hid the only thing that cleans those up. It is also a dead end:
          `perTenantSlugField` makes the surviving category slugs collide, so
          re-seeding fails forever with a 500.

          `pages` is in the sum for exactly the same reason. A merchant who
          bulk-deletes the seeded products, categories and media is left with a
          sample-flagged `home` page pointing at media that no longer exists —
          and removing this card would take away the only UI that resets it.
        */}
        {sampleCounts &&
          sampleCounts.products +
            sampleCounts.categories +
            sampleCounts.media +
            sampleCounts.pages >
            0 && (
            <RemoveSampleContentCard counts={sampleCounts} />
          )}

        {/*
          Unconditional on plan/sample state, unlike the card above: every
          merchant's catalog, orders and customers are theirs to download
          regardless of plan or whether any sample content survives. Nesting
          this inside the sampleCounts check would hide it for the common case
          of a merchant with no leftover samples, which is the opposite of
          what "no plan gate" requires.

          It IS gated on role, though, via the same `canExport` the route
          enforces: `ownsTenant` above (the page-level guard) admits
          tenant-staff too, but the export route 403s anyone below
          tenant-admin. Rendering the card unconditionally showed staff a
          button that always failed with a deliberately vague error. This
          call deliberately reuses `canExport` — the same function whose
          `false` the route turns into a 403 — rather than a second
          hand-rolled role check, so the button can never offer an action
          the API will go on to refuse.
        */}
        {/* The entrance to the same promise ExportDataCard is the exit from.
            Platform names come from the source registry so this copy cannot go
            stale the next time an adapter ships. */}
        <div id="import-store">
          <ImportStoreCard platforms={sourceRegistry.list().map((s) => s.label)} />
        </div>

        {canExport(typedUser, tenantId) && <ExportDataCard />}
      </div>
    </div>,
  )
}
