import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { headers } from 'next/headers'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { storeForHost } from '@/store-loader'
import { isSuperAdmin, ownsTenant, type TenantsArrayUser } from '@/access/roles'
import { listProviders } from '@/payments/core/provider-registry'
import { decryptCredentials, maskCredentials, type MaskedCredentials } from '@/payments/security/credential-encryption'
import type { Credentials } from '@/payments/core/types'
import type { GatewayConfig } from '@/payload-types'
import PaymentsSettingsClient, { type ProviderVM } from './PaymentsSettingsClient'
import { storeWhere } from '@/store-scope'

/**
 * Custom admin route view: Settings → Payments (path /settings/payments).
 *
 * Like the platform dashboard, this is a raw route view and must supply its own
 * DefaultTemplate. It resolves the tenant from the admin host (as AdminHome
 * does), guards on tenant-admin ownership, and renders one card PER REGISTRY
 * PROVIDER from that adapter's credentialSchema — adding a provider needs ZERO
 * changes here.
 */
export async function PaymentsSettingsView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user, i18n } = req

  const template = (children: React.ReactNode) => (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <div style={{ padding: '2rem', maxWidth: '900px' }}>{children}</div>
    </DefaultTemplate>
  )

  // Resolve the store from the admin host.
  const store = await storeForHost(await headers())
  if (!store) {
    return template(
      <>
        <h1>Payments</h1>
        <p>Open your store&apos;s admin (from its own domain) to manage payment providers.</p>
      </>,
    )
  }

  const typedUser = user as TenantsArrayUser | null
  if (!typedUser || (!isSuperAdmin(typedUser) && !ownsTenant(typedUser, store.id))) {
    return template(
      <>
        <h1>Not authorized</h1>
        <p>You don&apos;t have permission to manage this store&apos;s payments.</p>
      </>,
    )
  }

  // Load existing configs for this tenant (decrypted, server-side only).
  const { docs } = await payload.find({
    collection: 'gateway-configs',
    where: storeWhere(store.id),
    limit: 50,
    overrideAccess: true,
    context: { decryptSecrets: true },
  })
  const byProvider = new Map<string, GatewayConfig>()
  for (const d of docs as GatewayConfig[]) {
    byProvider.set(d.provider, d)
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000'
  const scheme = rootDomain.includes('localhost') || rootDomain.includes('lvh.me') ? 'http' : 'https'

  const providers: ProviderVM[] = listProviders().map((p) => {
    const row = byProvider.get(p.slug)
    let creds: Credentials = {}
    if (row?.encryptedCredentials) {
      try {
        creds = decryptCredentials(row.encryptedCredentials)
      } catch {
        creds = {}
      }
    }
    const masked: MaskedCredentials = maskCredentials(p.credentialSchema, creds)
    return {
      slug: p.slug,
      label: p.label,
      kind: p.kind,
      credentialSchema: p.credentialSchema,
      enabled: Boolean(row?.enabled) || Boolean(row?.active),
      environment: row?.environment ?? 'test',
      configured: Boolean(row),
      masked,
      webhookUrl:
        p.kind === 'offline'
          ? ''
          : `${scheme}://${store.slug}.${rootDomain}/api/webhooks/${p.slug}/${store.slug}`,
    }
  })

  return template(
    <PaymentsSettingsClient tenantId={store.id} providers={providers} />,
  )
}
