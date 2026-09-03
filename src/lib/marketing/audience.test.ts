import { vi, describe, expect, it } from 'vitest'
import { buildAudienceWhere } from './audience'
import type { Where } from 'payload'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

/**
 * Helper: given the returned Where, extract the top-level `and` array.
 * Every call to buildAudienceWhere MUST return `{ and: [...] }`.
 */
function getAndClauses(where: Where): Where[] {
  const and = (where as { and?: Where[] }).and
  if (!and || !Array.isArray(and)) throw new Error('Expected top-level `and` array')
  return and
}

/**
 * Checks the two hard invariants: tenant filter and subscribed-only filter.
 */
function assertHardInvariants(where: Where, tenantId: string) {
  const clauses = getAndClauses(where)
  // Tenant filter must be present
  const tenantClause = clauses.find(
    (c) => (c as { tenant?: { equals?: unknown } }).tenant?.equals === tenantId,
  )
  expect(tenantClause, `tenant filter for ${tenantId} must be present`).toBeDefined()

  // Subscribed-only filter must be present — HARD invariant; unsubscribed contacts must never match
  const statusClause = clauses.find(
    (c) => (c as { status?: { equals?: string } }).status?.equals === 'subscribed',
  )
  expect(statusClause, 'status: subscribed filter must always be present').toBeDefined()
}

describe('buildAudienceWhere', () => {
  describe('hard invariants (subscribed + tenant in every branch)', () => {
    it('mode:all — returns and[] with tenant + subscribed filters', () => {
      const where = buildAudienceWhere('tenant-1', { mode: 'all' })
      assertHardInvariants(where, 'tenant-1')
      expect(getAndClauses(where)).toHaveLength(2)
    })

    it('mode:tag — returns and[] with tenant + subscribed + tag filters', () => {
      const where = buildAudienceWhere('tenant-2', { mode: 'tag', tag: 'vip' })
      assertHardInvariants(where, 'tenant-2')
    })

    it('mode:source — returns and[] with tenant + subscribed + source filters', () => {
      const where = buildAudienceWhere('tenant-3', { mode: 'source', source: 'checkout' })
      assertHardInvariants(where, 'tenant-3')
    })

    it('mode:tag with missing tag — falls back to all-subscribed (2 clauses, no tag filter)', () => {
      const where = buildAudienceWhere('tenant-4', { mode: 'tag' })
      assertHardInvariants(where, 'tenant-4')
      expect(getAndClauses(where)).toHaveLength(2)
    })

    it('mode:tag with empty string tag — falls back to all-subscribed', () => {
      const where = buildAudienceWhere('tenant-5', { mode: 'tag', tag: '' })
      assertHardInvariants(where, 'tenant-5')
      expect(getAndClauses(where)).toHaveLength(2)
    })

    it('mode:source with missing source — falls back to all-subscribed (2 clauses, no source filter)', () => {
      const where = buildAudienceWhere('tenant-6', { mode: 'source' })
      assertHardInvariants(where, 'tenant-6')
      expect(getAndClauses(where)).toHaveLength(2)
    })

    it('mode:source with empty string source — falls back to all-subscribed', () => {
      const where = buildAudienceWhere('tenant-7', { mode: 'source', source: '' })
      assertHardInvariants(where, 'tenant-7')
      expect(getAndClauses(where)).toHaveLength(2)
    })
  })

  describe('mode-specific filters', () => {
    it('mode:all — does NOT add extra clauses beyond tenant + subscribed', () => {
      const where = buildAudienceWhere('t1', { mode: 'all' })
      expect(getAndClauses(where)).toHaveLength(2)
    })

    it('mode:tag — adds a tags contains clause', () => {
      const where = buildAudienceWhere('t1', { mode: 'tag', tag: 'newsletter' })
      const clauses = getAndClauses(where)
      expect(clauses).toHaveLength(3)
      const tagClause = clauses.find(
        (c) => (c as { tags?: { contains?: string } }).tags?.contains === 'newsletter',
      )
      expect(tagClause).toBeDefined()
    })

    it('mode:source — adds a source equals clause', () => {
      const where = buildAudienceWhere('t1', { mode: 'source', source: 'newsletter' })
      const clauses = getAndClauses(where)
      expect(clauses).toHaveLength(3)
      const sourceClause = clauses.find(
        (c) => (c as { source?: { equals?: string } }).source?.equals === 'newsletter',
      )
      expect(sourceClause).toBeDefined()
    })
  })

  describe('tenant id is threaded correctly', () => {
    it('uses the provided tenantId in the tenant filter', () => {
      const where = buildAudienceWhere('my-tenant-id', { mode: 'all' })
      const clauses = getAndClauses(where)
      const tenantClause = clauses.find(
        (c) => (c as { tenant?: { equals?: unknown } }).tenant?.equals === 'my-tenant-id',
      )
      expect(tenantClause).toBeDefined()
    })
  })
})
