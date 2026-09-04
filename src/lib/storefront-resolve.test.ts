import { beforeEach, describe, expect, it, vi } from 'vitest'

const headersMock = vi.fn()
vi.mock('next/headers', () => ({ headers: () => headersMock() }))
const storeForHost = vi.fn()
const storeBySlug = vi.fn()
vi.mock('@/store-loader', () => ({
  storeForHost: (...a: unknown[]) => storeForHost(...a),
  storeBySlug: (...a: unknown[]) => storeBySlug(...a),
}))
// storefront.ts imports the real @payload-config (payload.config.ts), which pulls in
// buildConfig, collections, and DB/S3/email adapters — none of that should load in a
// unit test. Stub the config module and payload itself.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ find: vi.fn() }) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { getStore, getTenantStatusBySlug, resolveStoreFromHost } = await import('./storefront')

const store = (status: 'active' | 'suspended') => ({
  id: 3,
  slug: 'store',
  name: 'Store',
  status,
  storefrontTheme: 'default',
  showsPlatformBranding: true,
})

beforeEach(() => {
  vi.clearAllMocks()
  headersMock.mockResolvedValue(new Headers({ host: 'store.lvh.me:3000' }))
})

describe('resolveStoreFromHost', () => {
  it('hands the request headers to the loader seam and returns an active store', async () => {
    storeForHost.mockResolvedValue(store('active'))
    await expect(resolveStoreFromHost()).resolves.toEqual(store('active'))
    expect(storeForHost.mock.calls[0]![0].get('host')).toBe('store.lvh.me:3000')
  })

  it('is null for a suspended store, so the storefront never serves it', async () => {
    storeForHost.mockResolvedValue(store('suspended'))
    await expect(resolveStoreFromHost()).resolves.toBeNull()
  })

  it('is null when the host names no store', async () => {
    storeForHost.mockResolvedValue(null)
    await expect(resolveStoreFromHost()).resolves.toBeNull()
  })
})

describe('getStore / getTenantStatusBySlug', () => {
  it('getStore hides a suspended store while the status lookup still sees it', async () => {
    storeBySlug.mockResolvedValue(store('suspended'))
    await expect(getStore('store')).resolves.toBeNull()
    await expect(getTenantStatusBySlug('store')).resolves.toBe('suspended')
  })

  it('both are null for an unknown slug', async () => {
    storeBySlug.mockResolvedValue(null)
    await expect(getStore('ghost')).resolves.toBeNull()
    await expect(getTenantStatusBySlug('ghost')).resolves.toBeNull()
  })
})
