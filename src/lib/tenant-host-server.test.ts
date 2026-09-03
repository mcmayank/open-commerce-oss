import { describe, expect, it, vi, beforeEach } from 'vitest'

// resolveStoreFromHost is orchestration over the store-resolver seam: hand the
// request headers and origin to resolveStoreSlug, then load the store. The
// seam's own behaviour (subdomains, custom domains, single-tenant mode) is
// covered by src/store-resolver.test.ts.
const headersMock = vi.fn()
vi.mock('next/headers', () => ({ headers: () => headersMock() }))

const resolveStoreSlugMock = vi.fn()
vi.mock('@/store-resolver', () => ({
  resolveStoreSlug: (...args: unknown[]) => resolveStoreSlugMock(...args),
}))

const getStoreMock = vi.fn()
vi.mock('@/lib/storefront', () => ({
  getStore: (...args: unknown[]) => getStoreMock(...args),
}))

import { resolveStoreFromHost } from './tenant-host-server'

const fakeHeaders = (host: string | null, proto: string | null = null) => ({
  get: (k: string) => {
    const key = k.toLowerCase()
    if (key === 'host') return host
    if (key === 'x-forwarded-proto') return proto
    return null
  },
})

describe('resolveStoreFromHost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hands the request headers and a proto-aware origin to the resolver, then loads the store', async () => {
    const headers = fakeHeaders('sdbakery.ae', 'https')
    headersMock.mockResolvedValue(headers)
    resolveStoreSlugMock.mockResolvedValue('sdbakery')
    getStoreMock.mockResolvedValue({ id: 2, slug: 'sdbakery' })

    const store = await resolveStoreFromHost()

    expect(resolveStoreSlugMock).toHaveBeenCalledWith({ headers, origin: 'https://sdbakery.ae' })
    expect(getStoreMock).toHaveBeenCalledWith('sdbakery')
    expect(store).toEqual({ id: 2, slug: 'sdbakery' })
  })

  it('returns null without loading anything when the resolver finds no store', async () => {
    headersMock.mockResolvedValue(fakeHeaders('lvh.me:3000'))
    resolveStoreSlugMock.mockResolvedValue(null)

    expect(await resolveStoreFromHost()).toBeNull()
    expect(getStoreMock).not.toHaveBeenCalled()
  })
})
