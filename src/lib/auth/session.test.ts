import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
beforeAll(() => { process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64) })
import { signSession, verifySession } from './session'
import { signMagicLink } from './magic-link'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

// ── getCurrentCustomer ──────────────────────────────────────────────────────
// Mocks below are module-scoped (vi.mock is hoisted) but only exercised by the
// describe block further down — the plain signSession/verifySession tests
// above never touch next/headers, payload, or storefront.
const cookiesMock = vi.fn()
vi.mock('next/headers', () => ({ cookies: () => cookiesMock() }))

// The store comes from the storefront's host resolution (which goes through
// the store-resolver and store-loader seams); this module only compares ids.
const resolveStoreFromHostMock = vi.fn()
vi.mock('@/lib/storefront', () => ({ resolveStoreFromHost: () => resolveStoreFromHostMock() }))

const findByIDMock = vi.fn()
vi.mock('payload', () => ({ getPayload: async () => ({ findByID: findByIDMock }) }))
vi.mock('@payload-config', () => ({ default: {} }))

describe('getCurrentCustomer', () => {
  beforeEach(() => vi.clearAllMocks())
  const STORE_ID = '42'
  const CUSTOMER_ID = '7'
  const withSession = () => {
    const token = signSession(STORE_ID, CUSTOMER_ID, 60_000)
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === 'oc_customer_session' ? { value: token } : undefined),
    })
  }

  it('resolves the customer for the store the host names, stripping secrets', async () => {
    withSession()
    resolveStoreFromHostMock.mockResolvedValue({ id: STORE_ID, slug: 'store' })
    findByIDMock.mockResolvedValue({
      id: CUSTOMER_ID,
      tenant: STORE_ID,
      email: 'shopper@example.com',
      passwordHash: 'should-be-stripped',
      magicLinkNonce: 'should-be-stripped-too',
    })

    const { getCurrentCustomer } = await import('./session')
    const customer = await getCurrentCustomer()

    expect(customer).toEqual({ id: CUSTOMER_ID, tenant: STORE_ID, email: 'shopper@example.com' })
  })

  it('is null when the host names no store, even with a valid session cookie', async () => {
    withSession()
    resolveStoreFromHostMock.mockResolvedValue(null)
    const { getCurrentCustomer } = await import('./session')
    await expect(getCurrentCustomer()).resolves.toBeNull()
    expect(findByIDMock).not.toHaveBeenCalled()
  })

  it("is null when the session's store is not the host's store", async () => {
    withSession()
    resolveStoreFromHostMock.mockResolvedValue({ id: '99', slug: 'other' })
    const { getCurrentCustomer } = await import('./session')
    await expect(getCurrentCustomer()).resolves.toBeNull()
  })
})

describe('session token', () => {
  it('round-trips tenant + customer', () => {
    const t = signSession('2', '5', 60_000)
    expect(verifySession(t)).toEqual({ tenantId: '2', customerId: '5' })
  })
  it('rejects a magic-link token even though it is validly HMAC-signed (cross-token-type confusion)', () => {
    const magicLinkToken = signMagicLink('2', '5', 'some-nonce', 60_000)
    expect(verifySession(magicLinkToken)).toBeNull()
  })
  it('rejects an expired token', () => {
    const t = signSession('2', '5', -1) // already expired
    expect(verifySession(t)).toBeNull()
  })
  it('rejects a tampered token', () => {
    const t = signSession('2', '5', 60_000)
    const bad = t.slice(0, -2) + (t.endsWith('aa') ? 'bb' : 'aa')
    expect(verifySession(bad)).toBeNull()
  })
  it('rejects garbage', () => {
    expect(verifySession('nope')).toBeNull()
    expect(verifySession('')).toBeNull()
  })
})
