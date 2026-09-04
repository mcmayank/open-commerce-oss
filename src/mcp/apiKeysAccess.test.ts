import { describe, expect, it } from 'vitest'
import { apiKeyOwnConstraint, enforceSelfUser } from './apiKeysAccess'
import type { TenantsArrayUser } from '@/access/roles'

const superAdmin: TenantsArrayUser = { roles: ['super-admin'], tenants: [] }
const member: TenantsArrayUser = { roles: [], tenants: [{ tenant: 7, roles: ['tenant-admin'] }] }

describe('apiKeyOwnConstraint', () => {
  it('super-admin: unconstrained (true)', () => {
    expect(apiKeyOwnConstraint(superAdmin, 1)).toBe(true)
  })
  it('member: constrained to keys they own (user == self)', () => {
    expect(apiKeyOwnConstraint(member, 42)).toEqual({ user: { equals: 42 } })
  })
  it('anonymous (null) user: denied', () => {
    expect(apiKeyOwnConstraint(null, undefined)).toBe(false)
  })
  it('member without a resolvable id: denied (fail closed)', () => {
    expect(apiKeyOwnConstraint(member, undefined)).toBe(false)
  })
})

describe('enforceSelfUser', () => {
  it('forces a member’s key to point at themselves, ignoring a spoofed user', () => {
    const out = enforceSelfUser(member, 42, { user: 999, label: 'x' })
    expect(out).toEqual({ user: 42, label: 'x' })
  })
  it('leaves a super-admin’s explicit user assignment intact (support use)', () => {
    const out = enforceSelfUser(superAdmin, 1, { user: 999, label: 'x' })
    expect(out).toEqual({ user: 999, label: 'x' })
  })
  it('defaults a super-admin’s missing user to self', () => {
    const out = enforceSelfUser(superAdmin, 1, { label: 'x' })
    expect(out).toEqual({ user: 1, label: 'x' })
  })
})
