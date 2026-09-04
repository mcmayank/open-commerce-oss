/**
 * POST /api/payments/test-connection
 *
 * Run the provider's read-only connection test against the store's SAVED
 * credentials. Never creates a charge. Rate-limited per (user, provider).
 *
 * Auth: tenant-admin of the target tenant (or super-admin). Returns a friendly
 * result — never the provider's raw error object.
 *
 * Body: { tenantId, provider }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { getStorePaymentConfig } from '@/payments/core/config-loader'
import { rateLimit } from '@/lib/rate-limit'

function isTenantAdmin(user: TenantsArrayUser | null, tenantId: string | number): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return getUserTenantIDs(user, 'tenant-admin').some((id) => String(id) === String(tenantId))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })

  let user: (TenantsArrayUser & { id: number | string }) | null = null
  try {
    const result = await payload.auth({ headers: request.headers })
    user = result.user as (TenantsArrayUser & { id: number | string }) | null
  } catch {
    /* unauthenticated */
  }
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const tenantId = body.tenantId as string | number | undefined
  const providerSlug = String(body.provider ?? '')
  if (!tenantId) return NextResponse.json({ ok: false, error: 'Missing tenantId' }, { status: 400 })
  if (!isTenantAdmin(user, tenantId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit: 5 tests / minute per (user, provider).
  const limited = rateLimit(`test-conn:${user.id}:${providerSlug}`, { limit: 5, windowMs: 60_000 })
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts — please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limited.retryAfterMs / 1000)) } },
    )
  }

  const loaded = await getStorePaymentConfig(tenantId, providerSlug, payload)
  if (!loaded) {
    return NextResponse.json(
      { ok: false, error: 'No saved configuration for this provider yet — save credentials first.' },
      { status: 400 },
    )
  }

  try {
    const result = await loaded.provider.testConnection(loaded.credentials, loaded.environment)
    console.log('[payments/test-connection]', {
      tenant: tenantId,
      provider: providerSlug,
      result: result.ok ? 'passed' : 'failed',
    })
    // Only safe fields — never the raw provider error.
    return NextResponse.json({ ok: result.ok, message: result.message, warnings: result.warnings })
  } catch (err) {
    console.error('[payments/test-connection] error', { tenant: tenantId, provider: providerSlug }, err)
    return NextResponse.json({ ok: false, message: 'Unable to contact the provider. Try again shortly.', warnings: [] })
  }
}
