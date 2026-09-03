/**
 * Load a store's payment configuration(s) and resolve the adapter + decrypted
 * credentials. Replaces the v1 `gateway.ts` loader.
 *
 * Credential source of truth is the `encryptedCredentials` blob; for stores not
 * yet migrated it falls back to the legacy discrete columns via the adapter's
 * own `mapLegacyColumns` (so the core never branches on provider id).
 *
 * A config counts as enabled if the new `enabled` flag is set OR the legacy
 * `active` flag is set (so existing v1 Stripe stores keep working untouched).
 */
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import type { Credentials, PaymentProvider } from './types'
import { getProvider } from './provider-registry'
import { decryptCredentials } from '@/payments/security/credential-encryption'
import { storeWhere } from '@/store-scope'

export interface LoadedPaymentConfig {
  configId: number | string
  provider: PaymentProvider
  slug: string
  credentials: Credentials
  environment: 'test' | 'live'
  enabled: boolean
}

/** Raw gateway-config row shape (decrypted fields present when decryptSecrets used). */
interface GatewayConfigRow {
  id: number | string
  provider: string
  enabled?: boolean | null
  active?: boolean | null
  environment?: 'test' | 'live' | null
  encryptedCredentials?: string | null
  secretKey?: string | null
  webhookSecret?: string | null
  publishableKey?: string | null
}

function buildCredentials(provider: PaymentProvider, row: GatewayConfigRow): Credentials {
  if (row.encryptedCredentials) {
    // The field's afterRead already decrypted the blob to plaintext JSON.
    return decryptCredentials(row.encryptedCredentials)
  }
  // Legacy fallback — provider owns its own mapping.
  return (
    provider.mapLegacyColumns?.({
      secretKey: row.secretKey,
      webhookSecret: row.webhookSecret,
      publishableKey: row.publishableKey,
    }) ?? {}
  )
}

function toLoaded(row: GatewayConfigRow): LoadedPaymentConfig | null {
  const provider = getProvider(row.provider)
  if (!provider) return null
  return {
    configId: row.id,
    provider,
    slug: row.provider,
    credentials: buildCredentials(provider, row),
    environment: row.environment ?? 'test',
    enabled: Boolean(row.enabled) || Boolean(row.active),
  }
}

/**
 * `@payload-config` is imported lazily rather than at module top level.
 *
 * Evaluating it calls `resolveDatabaseUrl()`, which throws when `DATABASE_URL`
 * is unset. Because `Orders.ts` imports this module, a static import made every
 * unit test that touched `Orders.ts` require a live database — and the failure
 * mode was silent: Vitest reported "Tests: no tests" with exit 1, so zero
 * assertions ran while the suite looked merely broken.
 *
 * Same pattern, and same reason, as `src/hosted/lib/admin-host.ts` and
 * `src/lib/auth/session.ts`. Guarded by `config-loader.import.test.ts`.
 */
async function resolvePayload(payload?: Payload): Promise<Payload> {
  if (payload) return payload
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

/**
 * Load a single store's config for a specific provider. Returns null when the
 * store has no config row for that provider.
 */
export async function getStorePaymentConfig(
  storeId: number | string,
  providerSlug: string,
  payload?: Payload,
): Promise<LoadedPaymentConfig | null> {
  const pl = await resolvePayload(payload)
  const { docs } = await pl.find({
    collection: 'gateway-configs',
    where: {
      and: [storeWhere(storeId), { provider: { equals: providerSlug } }],
    },
    limit: 1,
    overrideAccess: true,
    context: { decryptSecrets: true },
  })
  const row = docs[0] as GatewayConfigRow | undefined
  return row ? toLoaded(row) : null
}

/** Load all enabled configs for a store (used to offer providers at checkout). */
export async function listEnabledProviders(
  storeId: number | string,
  payload?: Payload,
): Promise<LoadedPaymentConfig[]> {
  const pl = await resolvePayload(payload)
  const { docs } = await pl.find({
    collection: 'gateway-configs',
    where: storeWhere(storeId),
    limit: 50,
    overrideAccess: true,
    context: { decryptSecrets: true },
  })
  return (docs as GatewayConfigRow[])
    .map(toLoaded)
    .filter((c): c is LoadedPaymentConfig => c !== null && c.enabled)
}
