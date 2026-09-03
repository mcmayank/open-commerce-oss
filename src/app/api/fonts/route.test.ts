import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { CatalogFamily } from '@/lib/fonts/types'

// route.ts imports `config from '@payload-config'` at module scope, and the
// real payload.config.ts throws at import time when DATABASE_URL is unset
// (see src/lib/migration-guard.ts). Stub it out rather than wire a real
// database just to import the route. Pattern matches export/route.test.ts,
// which has the identical auth shape as this route (storeForHost → 404,
// payload.auth in a try/catch, tenant-membership check → 403).
vi.mock('@payload-config', () => ({ default: {} }))

const authMock = vi.fn()
vi.mock('payload', () => ({ getPayload: async () => ({ auth: authMock }) }))

const storeForHostMock = vi.fn()
vi.mock('@/store-loader', () => ({
  storeForHost: (...args: unknown[]) => storeForHostMock(...args),
}))

// toAxes and toPickerFamily's use of it must stay real — only the network/
// cache-backed fetchCatalog is stubbed, so buildFontHref (also real) keeps
// governing `selectable` exactly as it does in production.
const fetchCatalogMock = vi.fn()
vi.mock('@/lib/fonts/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/fonts/catalog')>()
  return { ...actual, fetchCatalog: (...args: unknown[]) => fetchCatalogMock(...args) }
})

const { GET } = await import('./route')
const { toPickerFamily } = await import('@/lib/fonts/picker')

const req = (host?: string) =>
  new NextRequest('http://admin.niblr.store/api/fonts', {
    headers: host ? { host } : {},
  })

const tenantMember = (tenantId: number) => ({ tenants: [{ tenant: tenantId, roles: ['tenant-staff'] }] })
const superAdmin = { roles: ['super-admin'], tenants: [{ tenant: 999, roles: ['tenant-staff'] }] }

const inter: CatalogFamily = {
  family: 'Inter',
  category: 'sans-serif',
  weights: ['400', '700'],
  hasItalic: true,
  variable: { min: 100, max: 900 },
  subsets: ['latin'],
}

/**
 * The route handler's real logic (auth, host resolution, payload.auth) is
 * covered here, following the pattern in export/route.test.ts — the nearest
 * apt precedent, since it shares this route's exact auth shape. Only
 * getPayload, storeForHost, and fetchCatalog are mocked; isTenantMember
 * (local to route.ts) runs for real, as do isSuperAdmin/getUserTenantIDs.
 */
describe('GET /api/fonts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCatalogMock.mockResolvedValue([inter])
  })

  it('200s a member of the host-resolved tenant, with the trimmed picker payload', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantMember(42) })

    const res = await GET(req('aurora.niblr.store'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ families: [toPickerFamily(inter)] })
  })

  it('200s a super-admin regardless of their own tenant membership', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: superAdmin })

    const res = await GET(req('aurora.niblr.store'))

    expect(res.status).toBe(200)
    expect(fetchCatalogMock).toHaveBeenCalled()
  })

  it('403s an unauthenticated caller, without leaking catalog data', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: null })

    const res = await GET(req('aurora.niblr.store'))
    const body = await res.text()

    expect(res.status).toBe(403)
    expect(fetchCatalogMock).not.toHaveBeenCalled()
    expect(body).not.toContain('Inter')
    expect(body).not.toContain('families')
  })

  it('403s a member of a different tenant', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockResolvedValue({ user: tenantMember(99) })

    const res = await GET(req('aurora.niblr.store'))
    const body = await res.text()

    expect(res.status).toBe(403)
    expect(fetchCatalogMock).not.toHaveBeenCalled()
    expect(body).not.toContain('Inter')
    expect(body).not.toContain('families')
  })

  it('403s when payload.auth throws, rather than treating it as authorised', async () => {
    storeForHostMock.mockResolvedValue({ id: 42, slug: 'aurora', name: 'Aurora', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
    authMock.mockRejectedValue(new Error('bad token'))

    const res = await GET(req('aurora.niblr.store'))
    const body = await res.text()

    expect(res.status).toBe(403)
    expect(fetchCatalogMock).not.toHaveBeenCalled()
    expect(body).not.toContain('Inter')
    expect(body).not.toContain('families')
  })

  it('404s when the host resolves to no tenant, without ever consulting auth', async () => {
    storeForHostMock.mockResolvedValue(null)

    const res = await GET(req('nowhere.example'))

    expect(res.status).toBe(404)
    expect(authMock).not.toHaveBeenCalled()
    expect(fetchCatalogMock).not.toHaveBeenCalled()
  })
})

/**
 * This suite covers the one piece of real logic the route adds: trimming a
 * CatalogFamily down to what the picker needs, and computing `selectable`
 * off the shared buildFontHref so it can't disagree with the storefront's
 * own behaviour. GET-handler branches (auth, host resolution) are covered
 * above.
 */
describe('toPickerFamily', () => {
  const variableFamily: CatalogFamily = inter

  const staticFamily: CatalogFamily = {
    family: 'Pacifico',
    category: 'handwriting',
    weights: ['400'],
    hasItalic: false,
    variable: null,
    subsets: ['latin'],
  }

  const outOfRangeFamily: CatalogFamily = {
    family: 'Special Elite',
    category: 'display',
    weights: ['100', '900'],
    hasItalic: false,
    variable: null,
    subsets: ['latin'],
  }

  it('trims a variable family to the picker shape', () => {
    expect(toPickerFamily(variableFamily)).toEqual({
      family: 'Inter',
      category: 'sans-serif',
      variable: true,
      selectable: true,
    })
  })

  it('marks a static family selectable when a weight falls in the 300-800 window', () => {
    // Positive control for the test below: without it, a toPickerFamily that
    // hardcoded `selectable: false` would still pass the negative case.
    expect(toPickerFamily(staticFamily).selectable).toBe(true)
    expect(toPickerFamily(staticFamily).variable).toBe(false)
  })

  it('marks a static family unselectable when every weight falls outside 300-800', () => {
    expect(toPickerFamily(outOfRangeFamily).selectable).toBe(false)
  })

  it('does not leak weights, subsets, or hasItalic onto the trimmed shape', () => {
    const trimmed = toPickerFamily(variableFamily) as unknown as Record<string, unknown>
    expect(trimmed.weights).toBeUndefined()
    expect(trimmed.subsets).toBeUndefined()
    expect(trimmed.hasItalic).toBeUndefined()
  })
})
