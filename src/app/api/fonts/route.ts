/**
 * GET /api/fonts
 *
 * The Google Fonts catalog, for the admin's font picker.
 *
 * Auth: any member of the host's resolved tenant, or a super-admin. The catalog
 * is public information — it is Google's published list — so this check is not
 * protecting the payload. It exists so the endpoint cannot be used as an
 * unauthenticated proxy that spends this platform's API quota.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { storeForHost } from '@/store-loader'
import { fetchCatalog } from '@/lib/fonts/catalog'
import { toPickerFamily } from '@/lib/fonts/picker'

/** Any member of this tenant, or a super-admin. Reading the catalog is not an
 *  admin-only action, so this is deliberately broader than isTenantAdmin. */
function isTenantMember(user: TenantsArrayUser | null, tenantId: string | number): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return getUserTenantIDs(user).some((id) => String(id) === String(tenantId))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })

  const store = await storeForHost(request.headers)
  if (!store) {
    return NextResponse.json({ error: 'No store for this address.' }, { status: 404 })
  }

  let user: TenantsArrayUser | null = null
  try {
    const result = await payload.auth({ headers: request.headers })
    user = result.user as TenantsArrayUser | null
  } catch {
    /* treat as unauthenticated */
  }
  if (!isTenantMember(user, store.id)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  const families = await fetchCatalog()
  return NextResponse.json({ families: families.map(toPickerFamily) })
}
