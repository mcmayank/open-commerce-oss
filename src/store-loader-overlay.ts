import type { Payload } from 'payload'
import { STORE_SLUG } from '@/lib/store-slug'
import type { Store } from '@/store-loader'

/** The one store's id. Core never assumes it; the OSS build defines it here. */
const STORE_ID = 1

async function settingsDoc(payload: Payload) {
  const { docs } = await payload.find({ collection: 'store-settings', limit: 1, depth: 0, overrideAccess: true })
  return docs[0] as { id: number; storeName?: string | null; storefrontTheme?: string | null } | undefined
}

async function db() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

/**
 * OSS build: exactly one store. Its identity is synthetic (id 1, the
 * configured slug); its name and theme come from `store-settings`, which the
 * merchant edits in the admin (withSingleStore adds the theme field). There is
 * no `tenants` collection to read.
 */
export async function loadStore(slug: string): Promise<Store | null> {
  if (slug !== STORE_SLUG) return null
  const settings = await settingsDoc(await db())
  return {
    id: STORE_ID,
    slug,
    name: settings?.storeName ?? 'My Store',
    status: 'active',
    storefrontTheme: settings?.storefrontTheme ?? 'default',
    showsPlatformBranding: false,
  }
}

export async function loadStoreById(id: string | number): Promise<Store | null> {
  return String(id) === String(STORE_ID) ? loadStore(STORE_SLUG) : null
}

/** OSS: the theme is a store-settings field; every theme is available. */
export async function saveStoreTheme(
  payload: Payload,
  _storeId: string | number,
  theme: string,
  _user?: unknown,
): Promise<void> {
  const settings = await settingsDoc(payload)
  if (!settings) throw new Error('store-settings not set up yet')
  await payload.update({
    collection: 'store-settings',
    id: settings.id,
    data: { storefrontTheme: theme } as never,
    overrideAccess: true,
  })
}

/** OSS: the deployment's own domain is the store's domain. */
export async function countVerifiedDomains(_payload: Payload, _storeId: string | number): Promise<number> {
  return 1
}
