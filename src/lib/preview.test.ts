import { describe, expect, it, vi } from 'vitest'
import type { TenantsArrayUser } from '@/access/roles'
import {
  canPreview,
  resolveDraftState,
  resolvePreviewTheme,
  shouldServeDraft,
  PREVIEW_TENANT_COOKIE,
  PREVIEW_THEME_COOKIE,
} from './preview'

const superAdmin: TenantsArrayUser = { roles: ['super-admin'] as ('super-admin')[] }
const ownerOf1: TenantsArrayUser = { tenants: [{ tenant: 1, roles: ['tenant-admin'] }] }

describe('canPreview', () => {
  it('allows a super-admin', () => {
    expect(canPreview(superAdmin, 999)).toBe(true)
  })
  it('allows a tenant owner for their own tenant', () => {
    expect(canPreview(ownerOf1, 1)).toBe(true)
  })
  it('denies a tenant owner for a different tenant', () => {
    expect(canPreview(ownerOf1, 2)).toBe(false)
  })
  it('denies an undefined user', () => {
    expect(canPreview(undefined, 1)).toBe(false)
  })
  it('denies a null user', () => {
    expect(canPreview(null, 1)).toBe(false)
  })
})

describe('shouldServeDraft', () => {
  it('serves draft when enabled and cookie tenant matches host tenant', () => {
    expect(shouldServeDraft({ draftEnabled: true, cookieTenantId: '5', hostTenantId: 5 })).toBe(true)
  })
  it('does not serve draft when the cookie tenant differs (cross-tenant guard)', () => {
    expect(shouldServeDraft({ draftEnabled: true, cookieTenantId: '5', hostTenantId: 6 })).toBe(false)
  })
  it('does not serve draft when draft mode is off', () => {
    expect(shouldServeDraft({ draftEnabled: false, cookieTenantId: '5', hostTenantId: 5 })).toBe(false)
  })
  it('does not serve draft when the cookie is missing', () => {
    expect(shouldServeDraft({ draftEnabled: true, cookieTenantId: null, hostTenantId: 5 })).toBe(false)
  })
})

describe('resolveDraftState', () => {
  it('does not read the preview cookie when draft mode is off', async () => {
    // The whole point of this branch: on the normal-visitor path we must never
    // touch cookies() (a dynamic API), so the storefront route stays statically
    // cacheable instead of being dynamically rendered on every request.
    const readCookie = vi.fn()
    const isDraft = await resolveDraftState({
      draftEnabled: false,
      hostTenantId: 5,
      readCookie,
    })
    expect(isDraft).toBe(false)
    expect(readCookie).not.toHaveBeenCalled()
  })

  it('reads the cookie and serves the draft when enabled and tenant matches', async () => {
    const readCookie = vi.fn().mockResolvedValue('5')
    const isDraft = await resolveDraftState({
      draftEnabled: true,
      hostTenantId: 5,
      readCookie,
    })
    expect(isDraft).toBe(true)
    expect(readCookie).toHaveBeenCalledOnce()
  })

  it('reads the cookie but denies the draft across tenants', async () => {
    const readCookie = vi.fn().mockResolvedValue('5')
    const isDraft = await resolveDraftState({
      draftEnabled: true,
      hostTenantId: 6,
      readCookie,
    })
    expect(isDraft).toBe(false)
  })

  it('denies the draft when the cookie is missing', async () => {
    const readCookie = vi.fn().mockResolvedValue(undefined)
    const isDraft = await resolveDraftState({
      draftEnabled: true,
      hostTenantId: 5,
      readCookie,
    })
    expect(isDraft).toBe(false)
  })
})

describe('PREVIEW_TENANT_COOKIE', () => {
  it('is a stable cookie name', () => {
    expect(PREVIEW_TENANT_COOKIE).toBe('preview-tenant')
  })
})

describe('PREVIEW_THEME_COOKIE', () => {
  it('is a stable cookie name', () => {
    expect(PREVIEW_THEME_COOKIE).toBe('preview-theme')
  })
})

describe('resolvePreviewTheme', () => {
  it('reads NEITHER cookie when draft mode is off (keeps the storefront cacheable)', async () => {
    const readTenantCookie = vi.fn()
    const readThemeCookie = vi.fn()
    const slug = await resolvePreviewTheme({
      draftEnabled: false,
      hostTenantId: 5,
      readTenantCookie,
      readThemeCookie,
    })
    expect(slug).toBeNull()
    expect(readTenantCookie).not.toHaveBeenCalled()
    expect(readThemeCookie).not.toHaveBeenCalled()
  })

  it('returns the preview theme slug when draft is on and the tenant matches', async () => {
    const slug = await resolvePreviewTheme({
      draftEnabled: true,
      hostTenantId: 5,
      readTenantCookie: async () => '5',
      readThemeCookie: async () => 'editorial',
    })
    expect(slug).toBe('editorial')
  })

  it('returns "default" so a tenant can preview reverting to the default storefront', async () => {
    const slug = await resolvePreviewTheme({
      draftEnabled: true,
      hostTenantId: 5,
      readTenantCookie: async () => '5',
      readThemeCookie: async () => 'default',
    })
    expect(slug).toBe('default')
  })

  it('does not apply the preview theme across tenants', async () => {
    const slug = await resolvePreviewTheme({
      draftEnabled: true,
      hostTenantId: 6,
      readTenantCookie: async () => '5',
      readThemeCookie: async () => 'editorial',
    })
    expect(slug).toBeNull()
  })

  it('returns null when no theme cookie is set', async () => {
    const slug = await resolvePreviewTheme({
      draftEnabled: true,
      hostTenantId: 5,
      readTenantCookie: async () => '5',
      readThemeCookie: async () => undefined,
    })
    expect(slug).toBeNull()
  })
})
