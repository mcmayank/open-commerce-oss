import { describe, expect, it } from 'vitest'
import { extractTenantId, getUserTenantIDs, isSuperAdmin, ownsTenant, type TenantsArrayUser } from './roles'

const staffOfT1: TenantsArrayUser = {
  roles: [],
  tenants: [{ tenant: 1, roles: ['tenant-staff'] }],
}
const adminOfT2: TenantsArrayUser = {
  roles: [],
  tenants: [{ tenant: 2, roles: ['tenant-admin'] }, { tenant: 3, roles: ['tenant-staff'] }],
}
const superAdmin: TenantsArrayUser = { roles: ['super-admin'], tenants: [] }

describe('isSuperAdmin', () => {
  it('is true only for users with the super-admin role', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true)
    expect(isSuperAdmin(staffOfT1)).toBe(false)
    expect(isSuperAdmin(null)).toBe(false)
  })
})

describe('getUserTenantIDs', () => {
  it('returns all tenant ids when no role filter given', () => {
    expect(getUserTenantIDs(adminOfT2)).toEqual([2, 3])
  })
  it('filters by role', () => {
    expect(getUserTenantIDs(adminOfT2, 'tenant-admin')).toEqual([2])
    expect(getUserTenantIDs(staffOfT1, 'tenant-admin')).toEqual([])
  })
  it('handles populated tenant relationships (objects with id)', () => {
    const u: TenantsArrayUser = { roles: [], tenants: [{ tenant: { id: 7 }, roles: ['tenant-admin'] }] }
    expect(getUserTenantIDs(u)).toEqual([7])
  })
  it('returns empty for null user', () => {
    expect(getUserTenantIDs(null)).toEqual([])
  })
  it('returns empty for a user whose tenants is null', () => {
    expect(getUserTenantIDs({ roles: [], tenants: null })).toEqual([])
  })
})

describe('extractTenantId', () => {
  it('returns undefined for null/undefined', () => {
    expect(extractTenantId(null)).toBeUndefined()
    expect(extractTenantId(undefined)).toBeUndefined()
  })
  it('returns the scalar id as-is', () => {
    expect(extractTenantId(5)).toBe(5)
    expect(extractTenantId('abc')).toBe('abc')
  })
  it('unwraps a populated relationship object', () => {
    expect(extractTenantId({ id: 7 })).toBe(7)
  })
})

describe('ownsTenant', () => {
  const user: TenantsArrayUser = { roles: [], tenants: [{ tenant: 1 }, { tenant: { id: 2 } }] }
  it('is true for an owned tenant (scalar and object forms, string/number coerced)', () => {
    expect(ownsTenant(user, 1)).toBe(true)
    expect(ownsTenant(user, '2')).toBe(true)
  })
  it('is false for a non-owned tenant', () => {
    expect(ownsTenant(user, 42)).toBe(false)
  })
})
