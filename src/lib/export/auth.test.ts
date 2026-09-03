import { describe, it, expect } from 'vitest'
import { canExport } from './auth'
import type { TenantsArrayUser } from '@/access/roles'

const admin = (tenantId: number): TenantsArrayUser =>
  ({ tenants: [{ tenant: tenantId, roles: ['tenant-admin'] }] }) as unknown as TenantsArrayUser

const superAdmin = () => ({ roles: ['super-admin'], tenants: [] }) as unknown as TenantsArrayUser

const staff = (tenantId: number): TenantsArrayUser =>
  ({ tenants: [{ tenant: tenantId, roles: ['tenant-staff'] }] }) as unknown as TenantsArrayUser

describe('canExport', () => {
  it('refuses an unauthenticated caller', () => {
    expect(canExport(null, 1)).toBe(false)
  })

  it('allows a tenant-admin of this tenant', () => {
    expect(canExport(admin(1), 1)).toBe(true)
  })

  // The whole store lands in one buffer, so the cross-tenant case is the one
  // that matters most.
  it('refuses a tenant-admin of a different tenant', () => {
    expect(canExport(admin(2), 1)).toBe(false)
  })

  it('allows a super-admin', () => {
    expect(canExport(superAdmin(), 1)).toBe(true)
  })

  it('compares ids across string and number forms', () => {
    expect(canExport(admin(1), '1')).toBe(true)
  })

  // The doc comment says "Tenant-admin ... Nothing else." A tenant-staff
  // member can read the admin UI but must not be able to walk out with the
  // whole store — orders and customer PII included — in one download.
  it('refuses a tenant-staff member of this tenant', () => {
    expect(canExport(staff(1), 1)).toBe(false)
  })

  it('refuses tenant-staff of tenant 1 even when the same user is tenant-admin of tenant 2', () => {
    const mixed = {
      tenants: [
        { tenant: 1, roles: ['tenant-staff'] },
        { tenant: 2, roles: ['tenant-admin'] },
      ],
    } as unknown as TenantsArrayUser
    expect(canExport(mixed, 1)).toBe(false)
    expect(canExport(mixed, 2)).toBe(true)
  })

  // getUserTenantIDs accepts `tenant` as a bare id or a populated relationship
  // ({ id }); the fixtures above only ever exercise the bare-id shape.
  it('allows a tenant-admin whose tenant relationship is populated ({ id }) rather than a bare id', () => {
    const populated = {
      tenants: [{ tenant: { id: 1 }, roles: ['tenant-admin'] }],
    } as unknown as TenantsArrayUser
    expect(canExport(populated, 1)).toBe(true)
  })
})
