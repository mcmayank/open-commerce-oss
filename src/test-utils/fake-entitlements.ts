/**
 * A plan-backed entitlements overlay for CORE tests that exercise refusal
 * paths (quota gates, premium gates). Self-contained on purpose: it must work
 * in the OSS export, where src/hosted/ does not exist and the real overlay
 * grants everything. Use as
 *
 *   vi.mock('@/entitlements-overlay', () => import('@/test-utils/fake-entitlements'))
 *
 * `free` gets nothing and tiny caps; any other plan gets everything on.
 */
import type { Payload } from 'payload'
import type { EntitledStore, Entitlements, StoreUsage } from '@/entitlements'

function limits(plan: string | null | undefined): Entitlements {
  const free = !plan || plan === 'free'
  return {
    maxProducts: free ? 50 : Number.POSITIVE_INFINITY,
    maxStorageBytes: free ? 250 * 1024 * 1024 : Number.POSITIVE_INFINITY,
    premiumSections: !free,
    mcpWrites: !free,
    voiceAssistant: !free,
    customCss: !free,
    customSections: !free,
    customDomains: !free,
    giftCards: !free,
    label: free ? 'Free' : 'Growth',
    canUpgrade: free,
  }
}

export async function resolveOf(store: EntitledStore): Promise<Entitlements> {
  return limits(store.plan)
}

export async function resolveById(
  payload: Payload,
  storeId: string | number,
): Promise<Entitlements & { usage: StoreUsage }> {
  // Typed loosely: the tests hand in a fake payload, and the OSS export has no tenants collection.
  const findByID = payload.findByID as unknown as (args: Record<string, unknown>) => Promise<unknown>
  const t = (await findByID({ collection: 'tenants', id: storeId, depth: 0, overrideAccess: true })) as {
    plan?: string | null
    mediaBytesUsed?: number | null
  } | null
  return { ...limits(t?.plan), usage: { mediaBytesUsed: t?.mediaBytesUsed ?? 0 } }
}

export async function resolveForHost(): Promise<Entitlements | null> {
  return null
}
