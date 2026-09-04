import { vi, describe, it, expect, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
// Forward ALL args so tests assert the decided cache profile, not just the tag.
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }))

import { storeBySlugTag, tenantTag, revalidateTenantHook, revalidateTenantSlugHook, revalidateMediaHook } from './storefront-cache'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

// Immediate-expiry profile: the merchant's edit shows on the next storefront view.
const IMMEDIATE = { expire: 0 }

describe('storefront cache tags', () => {
  it('storeBySlugTag', () => {
    expect(storeBySlugTag('sdbakery')).toBe('store-by-slug:sdbakery')
  })
  it('tenantTag per kind and id type', () => {
    expect(tenantTag(7, 'products')).toBe('tenant:7:products')
    expect(tenantTag('7', 'settings')).toBe('tenant:7:settings')
    expect(tenantTag(12, 'pages')).toBe('tenant:12:pages')
    expect(tenantTag(12, 'categories')).toBe('tenant:12:categories')
  })
})

describe('revalidateTenantHook', () => {
  beforeEach(() => revalidateTag.mockReset())

  it('purges tenant+kind tag immediately on change (tenant as id)', () => {
    revalidateTenantHook('products').afterChange({ doc: { tenant: 7 } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:7:products', IMMEDIATE)
  })
  it('purges tenant+kind tag on change (tenant as object)', () => {
    revalidateTenantHook('categories').afterChange({ doc: { tenant: { id: 9 } } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:9:categories', IMMEDIATE)
  })
  it('purges on delete', () => {
    revalidateTenantHook('pages').afterDelete({ doc: { tenant: 'A' } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:A:pages', IMMEDIATE)
  })
  it('no-ops when tenant missing', () => {
    revalidateTenantHook('settings').afterChange({ doc: {} } as any)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it('swallows revalidate errors (non-request scope)', () => {
    revalidateTag.mockImplementationOnce(() => { throw new Error('outside request scope') })
    expect(() => revalidateTenantHook('products').afterChange({ doc: { tenant: 1 } } as any)).not.toThrow()
  })
})

describe('revalidateTenantSlugHook', () => {
  beforeEach(() => revalidateTag.mockReset())

  it('purges the store-by-slug tag immediately on change', () => {
    revalidateTenantSlugHook.afterChange({ doc: { slug: 'acme' } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('store-by-slug:acme', IMMEDIATE)
  })
  it('purges both new and previous slug on rename', () => {
    revalidateTenantSlugHook.afterChange({ doc: { slug: 'new' }, previousDoc: { slug: 'old' } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('store-by-slug:new', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledWith('store-by-slug:old', IMMEDIATE)
  })
  it('purges on delete', () => {
    revalidateTenantSlugHook.afterDelete({ doc: { slug: 'gone' } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('store-by-slug:gone', IMMEDIATE)
  })
})

describe('revalidateMediaHook', () => {
  beforeEach(() => revalidateTag.mockReset())

  it('purges products, pages, and settings for the tenant on change', () => {
    revalidateMediaHook.afterChange({ doc: { tenant: 5 } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:5:products', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:5:pages', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:5:settings', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledTimes(3)
  })
  it('purges the same three on delete (tenant as object)', () => {
    revalidateMediaHook.afterDelete({ doc: { tenant: { id: 'B' } } } as any)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:B:products', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:B:pages', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledWith('tenant:B:settings', IMMEDIATE)
    expect(revalidateTag).toHaveBeenCalledTimes(3)
  })
  it('no-ops when tenant missing', () => {
    revalidateMediaHook.afterChange({ doc: {} } as any)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
