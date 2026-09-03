/**
 * POST /api/payments/config
 *
 * Save a store's payment configuration for one provider. Writes credentials
 * through the encrypted blob field (encryption happens in the field hook, never
 * here). Never returns secrets — only a masked view.
 *
 * Auth: authenticated store admin who is a tenant-admin of the target tenant
 * (or super-admin). The tenantId in the body is always re-verified against the
 * user's memberships — a client cannot write another tenant's config.
 *
 * Body: { tenantId, provider, enabled, environment, credentials: {...} }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { getProvider } from '@/payments/core/provider-registry'
import {
  mergeCredentials,
  maskCredentials,
  decryptCredentials,
  CREDENTIAL_MASK,
} from '@/payments/security/credential-encryption'
import type { Credentials } from '@/payments/core/types'
import { storeWhere, storeRef } from '@/store-scope'

function isTenantAdmin(user: TenantsArrayUser | null, tenantId: string | number): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return getUserTenantIDs(user, 'tenant-admin').some((id) => String(id) === String(tenantId))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })

  // 1. Authenticate.
  let user: (TenantsArrayUser & { id: number | string }) | null = null
  try {
    const result = await payload.auth({ headers: request.headers })
    user = result.user as (TenantsArrayUser & { id: number | string }) | null
  } catch {
    /* treat as unauthenticated */
  }
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // 2. Parse body.
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const tenantId = body.tenantId as string | number | undefined
  const providerSlug = String(body.provider ?? '')
  const enabled = Boolean(body.enabled)
  const environment = body.environment === 'live' ? 'live' : 'test'
  const incoming = (body.credentials as Credentials | undefined) ?? {}

  if (!tenantId) return NextResponse.json({ ok: false, error: 'Missing tenantId' }, { status: 400 })

  // 3. Authorize against the *verified* tenant membership.
  if (!isTenantAdmin(user, tenantId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const provider = getProvider(providerSlug)
  if (!provider) {
    return NextResponse.json({ ok: false, error: 'Unknown provider' }, { status: 400 })
  }

  // 4. Load existing config (decrypted) to merge blank/masked secrets.
  const { docs } = await payload.find({
    collection: 'gateway-configs',
    where: { and: [storeWhere(tenantId), { provider: { equals: providerSlug } }] },
    limit: 1,
    overrideAccess: true,
    context: { decryptSecrets: true },
  })
  const existingRow = docs[0] as { id: number | string; encryptedCredentials?: string | null; configurationVersion?: number } | undefined
  const existingCreds: Credentials = existingRow?.encryptedCredentials
    ? decryptCredentials(existingRow.encryptedCredentials)
    : {}

  const merged = mergeCredentials(provider.credentialSchema, existingCreds, incoming)

  // 5. If enabling, ensure required credentials are present.
  if (enabled) {
    const missing = provider.credentialSchema
      .filter((f) => f.required)
      .filter((f) => !merged[f.name] || merged[f.name] === CREDENTIAL_MASK)
      .map((f) => f.label)
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Missing required credentials: ${missing.join(', ')}` },
        { status: 400 },
      )
    }
  }

  // 6. Upsert. The encryptedCredentials field encrypts the plaintext JSON blob.
  const data = {
    ...storeRef(Number(tenantId)),
    provider: providerSlug,
    enabled,
    environment: environment as 'test' | 'live',
    encryptedCredentials: JSON.stringify(merged),
    configurationVersion: (existingRow?.configurationVersion ?? 0) + 1,
  }
  try {
    if (existingRow) {
      await payload.update({ collection: 'gateway-configs', id: existingRow.id, data, overrideAccess: true })
    } else {
      await payload.create({ collection: 'gateway-configs', data, overrideAccess: true })
    }
  } catch (err) {
    console.error('[payments/config] save failed', { tenant: tenantId, provider: providerSlug }, err)
    return NextResponse.json({ ok: false, error: 'Failed to save configuration' }, { status: 500 })
  }

  console.log('[payments/config] saved', { tenant: tenantId, provider: providerSlug, enabled, environment })
  // 7. Return a masked view only — never secrets.
  return NextResponse.json({ ok: true, masked: maskCredentials(provider.credentialSchema, merged) })
}
