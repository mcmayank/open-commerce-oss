import type { ServerProps } from 'payload'
import { headers } from 'next/headers'
import { storeForHost } from '@/store-loader'
import { isSuperAdmin, type TenantsArrayUser } from '@/access/roles'
import { entitlementsOf } from '@/entitlements'
import { AdminNavClient, type StoreChip } from './AdminNav.client'
import { navBadges } from './nav-badges'

/**
 * `admin.components.Nav` — server wrapper around `AdminNavClient` (Task 3).
 *
 * Resolves host → store exactly like `AdminHome.tsx`: `headers()` from
 * `next/headers`, then `storeForHost(headers)`. Unlike
 * `AdminHome` (an `AdminViewServerProps` view, which nests `payload`/`user`
 * under `initPageResult.req`), the Nav slot is a `CustomComponent` and gets
 * `payload`/`user` directly on `ServerProps` — see payload's
 * `config/types.d.ts`.
 */
export async function AdminNav(props: ServerProps) {
  const { payload, user } = props

  const hostHeaders = await headers()
  const host = hostHeaders.get('host')
  const resolved = await storeForHost(hostHeaders)

  const isPlatformApex = resolved === null
  // Mirrors HostBindingProvider's host-binding signal (bindingDecision.ts):
  // bound whenever the host itself resolves to a real store.
  const isHostBound = resolved !== null && Boolean(host)

  let store: StoreChip | null = null
  let badges: Record<string, number> = {}

  if (resolved) {
    try {
      // `suspended` is a distinct danger state (storefront returns
      // StoreUnavailable — src/app/(storefront)/store/[tenant]/layout.tsx —
      // and the platform dashboard gives it the 'danger' tone), not the
      // merchant's own unpublished "draft" choice. Collapsing it into
      // 'draft' would hide from the merchant that their store is down.
      store = {
        name: resolved.name,
        plan: (await entitlementsOf(resolved)).label,
        status:
          resolved.status === 'active' ? 'live' : resolved.status === 'suspended' ? 'suspended' : 'draft',
      }
    } catch {
      // Best-effort: a lookup failure must never block nav render.
      store = null
    }

    badges = await navBadges(payload, String(resolved.id))
  }

  const typedUser = user as (TenantsArrayUser & { id?: string | number; email?: string }) | null
  const userId = typedUser?.id != null ? String(typedUser.id) : ''
  const userName = typedUser?.email ?? ''
  const userRole = isSuperAdmin(typedUser)
    ? 'Super Admin'
    : resolved
      ? roleForTenant(typedUser, resolved.id)
      : 'Member'

  return (
    <AdminNavClient
      store={store}
      userId={userId}
      userName={userName}
      userRole={userRole}
      badges={badges}
      isPlatformApex={isPlatformApex}
      isHostBound={isHostBound}
    />
  )
}

/** Display role for a user's membership in the current host tenant. */
function roleForTenant(user: TenantsArrayUser | null, tenantId: string | number): string {
  const membership = user?.tenants?.find((row) => {
    const t = row.tenant
    const id = typeof t === 'object' ? t.id : t
    return String(id) === String(tenantId)
  })
  if (membership?.roles?.includes('tenant-admin')) return 'Owner'
  if (membership?.roles?.includes('tenant-staff')) return 'Staff'
  return 'Member'
}
