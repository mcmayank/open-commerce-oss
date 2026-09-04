/**
 * GET /api/theme/preset
 *
 * The fully-resolved token preset for the caller's tenant's active theme —
 * i.e. what their storefront renders when a branding field is left unset.
 *
 * Exists because the admin branding form has to show what "inherit" resolves
 * to, and the theme slug lives on the tenant, not on the store-settings doc
 * being edited.
 *
 * Auth: any member of the host's resolved tenant, or a super-admin. The tokens
 * themselves are public — they're what the tenant's storefront already renders
 * — so this check isn't protecting the payload. It exists so an authenticated
 * user of one tenant cannot swap the Host header and enumerate every other
 * tenant's active theme.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { storeForHost } from '@/store-loader'
import { getThemeMeta } from '@/themes/catalog'
import { presetTokens } from '@/lib/theme-tokens'

/** Any member of this tenant, or a super-admin. Reading design tokens is not
 *  an admin-only action, so this is deliberately broader than isTenantAdmin. */
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

  const slug = store.storefrontTheme || 'default'
  const meta = getThemeMeta(slug)

  return NextResponse.json({ slug, tokens: presetTokens(meta?.tokens) })
}
