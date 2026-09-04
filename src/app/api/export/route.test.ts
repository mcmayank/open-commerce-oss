import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// route.ts imports the real @payload-config (payload.config.ts), which pulls in
// buildConfig, collections, and DB/S3/email adapters — none of that should load
// in a unit test. Stub the config module itself, matching the pattern in
// storefront-resolve.test.ts.
vi.mock('@payload-config', () => ({ default: {} }))

const authMock = vi.fn()
vi.mock('payload', () => ({ getPayload: async () => ({ auth: authMock }) }))

const storeForHostMock = vi.fn()
vi.mock('@/store-loader', () => ({
  storeForHost: (...args: unknown[]) => storeForHostMock(...args),
}))

const collectExportDataMock = vi.fn()
const buildExportFilesMock = vi.fn()
vi.mock('@/lib/export/collect', () => ({
  collectExportData: (...args: unknown[]) => collectExportDataMock(...args),
  buildExportFiles: (...args: unknown[]) => buildExportFilesMock(...args),
}))

// canExport (the real, unmocked implementation from Task 5) is exercised
// as-is: these are the plan-enforcement functions `/api/samples/seed` calls
// for its plan gate. Spied, not stubbed, so the real implementation still
// runs if something does call them — the assertion is call count, not return
// value. If a future change adds any of these calls to the export route, the
// "no plan gate" tests below start failing.
vi.mock('@/lib/plan-enforcement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/plan-enforcement')>()
  return {
    ...actual,
    assertStorageQuota: vi.fn(actual.assertStorageQuota),
  }
})

const { assertStorageQuota } = await import('@/lib/plan-enforcement')
const { POST } = await import('./route')

const req = (opts: { host?: string; body?: unknown } = {}) =>
  new NextRequest('http://localhost/api/export', {
    method: 'POST',
    headers: opts.host ? { host: opts.host } : {},
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })

const tenantAdmin = (tenantId: number) => ({ tenants: [{ tenant: tenantId, roles: ['tenant-admin'] }] })

const FILES = [{ name: 'products.csv', content: 'a,b\n1,2\n' }]

describe('POST /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    collectExportDataMock.mockResolvedValue({
      storeCurrency: 'AED',
      products: [],
      categories: [],
      orders: [],
      customers: [],
    })
    buildExportFilesMock.mockReturnValue(FILES)
  })

  it('200s a tenant-admin of the host-resolved tenant, with a zip content type and the tenant slug in the filename', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantAdmin(42) })

    const res = await POST(req({ host: 'aurora.niblr.store' }))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')
    expect(res.headers.get('Content-Disposition')).toContain('aurora')
    expect(collectExportDataMock).toHaveBeenCalledWith(expect.anything(), 42)
  })

  // Media URLs are stored root-relative, so the origin has to reach
  // buildExportFiles or every image cell in the CSVs is a dead link.
  it('passes the request origin to buildExportFiles', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantAdmin(42) })

    await POST(req({ host: 'sdbakery.ae' }))

    expect(buildExportFilesMock).toHaveBeenCalledWith(expect.anything(), 'https://sdbakery.ae')
  })

  // The no-plan-gate requirement, at the layer a gate would actually be added
  // (see /api/samples/seed, which calls exactly these two functions). A Free
  // tenant gets a 200 and neither plan-enforcement function is ever touched.
  it('200s a Free-plan tenant, without calling any plan-enforcement function', async () => {
    storeForHostMock.mockResolvedValue({ id: 7, slug: 'free-store', name: 'Free', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantAdmin(7) })

    const res = await POST(req({ host: 'free-store.niblr.store' }))

    expect(res.status).toBe(200)
    expect(assertStorageQuota).not.toHaveBeenCalled()
  })

  it('403s a tenant-admin of a different tenant', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantAdmin(99) })

    const res = await POST(req({ host: 'aurora.niblr.store' }))

    expect(res.status).toBe(403)
    expect(collectExportDataMock).not.toHaveBeenCalled()
  })

  it('403s an unauthenticated caller', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: null })

    const res = await POST(req({ host: 'aurora.niblr.store' }))

    expect(res.status).toBe(403)
    expect(collectExportDataMock).not.toHaveBeenCalled()
  })

  it('403s when payload.auth throws, rather than treating it as authorised', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockRejectedValue(new Error('bad token'))

    const res = await POST(req({ host: 'aurora.niblr.store' }))

    expect(res.status).toBe(403)
    expect(collectExportDataMock).not.toHaveBeenCalled()
  })

  it('404s when the host resolves to root', async () => {
    storeForHostMock.mockResolvedValue(null)

    const res = await POST(req({ host: 'niblr.store' }))

    expect(res.status).toBe(404)
    expect(authMock).not.toHaveBeenCalled()
  })

  it('404s when the host resolves to nothing', async () => {
    storeForHostMock.mockResolvedValue(null)

    const res = await POST(req({ host: 'nowhere.example' }))

    expect(res.status).toBe(404)
    expect(authMock).not.toHaveBeenCalled()
  })

  // The tenant must come from the HOST, never the body. A client cannot name
  // another store's id in the request and export it.
  it('ignores a tenant id supplied in the body, scoping to the host tenant instead', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantAdmin(42) })

    const res = await POST(req({ host: 'aurora.niblr.store', body: { tenantId: 999, tenant: 999 } }))

    expect(res.status).toBe(200)
    expect(collectExportDataMock).toHaveBeenCalledWith(expect.anything(), 42)
    expect(collectExportDataMock).not.toHaveBeenCalledWith(expect.anything(), 999)
    expect(res.headers.get('Content-Disposition')).toContain('aurora')
  })
})
