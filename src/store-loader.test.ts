import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveStoreSlug = vi.fn()
const loadStore = vi.fn()
vi.mock('@/store-resolver', () => ({ resolveStoreSlug: (...a: unknown[]) => resolveStoreSlug(...a) }))
vi.mock('@/store-loader-overlay', () => ({ loadStore: (...a: unknown[]) => loadStore(...a) }))
// unstable_cache needs a request scope; make it a pass-through here.
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { storeBySlug, storeForHost } = await import('./store-loader')

const aurora = {
  id: 42,
  slug: 'aurora',
  name: 'Aurora',
  status: 'active',
  storefrontTheme: 'default',
  showsPlatformBranding: true,
}

beforeEach(() => {
  resolveStoreSlug.mockReset()
  loadStore.mockReset()
})

describe('storeForHost', () => {
  it('asks the resolver seam for the slug and the loader seam for the store', async () => {
    resolveStoreSlug.mockResolvedValue('aurora')
    loadStore.mockResolvedValue(aurora)
    const headers = new Headers({ host: 'aurora.niblr.store' })
    await expect(storeForHost(headers)).resolves.toEqual(aurora)
    expect(resolveStoreSlug).toHaveBeenCalledWith({ headers })
    expect(loadStore).toHaveBeenCalledWith('aurora')
  })

  it('is null, without a lookup, when the host names no store', async () => {
    resolveStoreSlug.mockResolvedValue(null)
    await expect(storeForHost(new Headers({ host: 'niblr.store' }))).resolves.toBeNull()
    expect(loadStore).not.toHaveBeenCalled()
  })

  it('is status-blind: a suspended store still resolves', async () => {
    resolveStoreSlug.mockResolvedValue('aurora')
    loadStore.mockResolvedValue({ ...aurora, status: 'suspended' })
    await expect(storeForHost(new Headers())).resolves.toMatchObject({ status: 'suspended' })
  })
})

describe('storeBySlug', () => {
  it('passes the loader miss through as null', async () => {
    loadStore.mockResolvedValue(null)
    await expect(storeBySlug('ghost')).resolves.toBeNull()
  })
})
