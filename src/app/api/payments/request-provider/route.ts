/**
 * POST /api/payments/request-provider
 *
 * Lets a store admin request a payment provider we don't yet support. Records a
 * `payment-gateway-requests` row for the platform team to triage.
 *
 * Auth: tenant-admin of the target tenant (or super-admin). Rate-limited.
 * Body: { tenantId, providerName, note? }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { getProvider } from '@/payments/core/provider-registry'
import { rateLimit } from '@/lib/rate-limit'
import { storeRef } from '@/store-scope'

function isTenantAdmin(user: TenantsArrayUser | null, tenantId: string | number): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return getUserTenantIDs(user, 'tenant-admin').some((id) => String(id) === String(tenantId))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })

  let user: (TenantsArrayUser & { id: number | string; email?: string }) | null = null
  try {
    const result = await payload.auth({ headers: request.headers })
    user = result.user as (TenantsArrayUser & { id: number | string; email?: string }) | null
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
  const providerName = String(body.providerName ?? '').trim()
  const note = String(body.note ?? '').trim() || undefined

  if (!tenantId) return NextResponse.json({ ok: false, error: 'Missing tenantId' }, { status: 400 })
  if (!providerName) return NextResponse.json({ ok: false, error: 'Please name the provider you want.' }, { status: 400 })
  if (providerName.length > 100) return NextResponse.json({ ok: false, error: 'Provider name is too long.' }, { status: 400 })
  if (!isTenantAdmin(user, tenantId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // If it already exists in the registry, tell them (no request needed).
  if (getProvider(providerName.toLowerCase())) {
    return NextResponse.json(
      { ok: false, error: `${providerName} is already supported — enable it in Settings → Payments.` },
      { status: 400 },
    )
  }

  const limited = rateLimit(`request-provider:${user.id}`, { limit: 5, windowMs: 60_000 })
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests — please wait a minute.' },
      { status: 429 },
    )
  }

  try {
    await payload.create({
      collection: 'payment-gateway-requests',
      data: {
        ...storeRef(Number(tenantId)),
        providerName,
        note,
        requestedByEmail: user.email,
        status: 'new',
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[payments/request-provider] failed', { tenant: tenantId }, err)
    return NextResponse.json({ ok: false, error: 'Could not submit your request.' }, { status: 500 })
  }

  console.log('[payments/request-provider] submitted', { tenant: tenantId, providerName })
  return NextResponse.json({ ok: true, message: `Thanks — we've logged your request for ${providerName}.` })
}
