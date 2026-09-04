import type { AdminViewServerProps } from 'payload'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { storeForHost } from '@/store-loader'
import { isSuperAdmin, type TenantsArrayUser } from '@/access/roles'
import { TenantDashboard } from '@/components/TenantDashboard'
import type { SampleCounts } from '@/lib/sample-seed'
import { storeWhere } from '@/store-scope'

export async function AdminHome(props: AdminViewServerProps) {
  const { user, payload } = props.initPageResult.req

  const store = await storeForHost(await headers())

  if (store) {
    // Counted here (payload is already on the request) and handed down as a
    // prop rather than rendered as a sibling — TenantDashboard owns the
    // `.nb-view`/`.nb-stack` layout and its own authorization guard, so the
    // card must render from inside that JSX, after the guard, or an
    // unauthorized viewer would see sample-content counts alongside
    // TenantDashboard's "Not authorized" message, and the card would sit
    // outside the page's padding/max-width.
    const sampleCounts: SampleCounts = { media: 0, categories: 0, products: 0, pages: 0 }
    for (const collection of ['products', 'categories', 'media', 'pages'] as const) {
      const r = await payload.find({
        collection,
        where: {
          and: [storeWhere(store.id), { isSampleContent: { equals: true } }],
        },
        limit: 0,
        overrideAccess: true,
      })
      sampleCounts[collection] = r.totalDocs
    }

    return (
      <TenantDashboard
        {...props}
        tenantId={store.id}
        tenantSlug={store.slug}
        sampleCounts={sampleCounts}
      />
    )
  }

  // No store on this host (hosted: the platform apex or an unknown domain).
  // A super-admin's home is the platform dashboard.
  if (isSuperAdmin(user as TenantsArrayUser | null)) {
    redirect('/admin/platform')
  }

  // Payload wraps the dashboard view in DefaultTemplate already — render inner content only.
  return (
    <div style={{ padding: '2rem' }}>
      <h1>No store found</h1>
      <p>This admin isn&apos;t bound to a store. If you manage a store, open its admin from your store&apos;s domain.</p>
    </div>
  )
}
