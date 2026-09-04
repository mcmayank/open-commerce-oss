import { describe, it, expect } from 'vitest'
import { isDuplicateKeyError } from '@/lib/webhook-utils'

describe('isDuplicateKeyError', () => {
  it('returns true for Postgres error code 23505', () => {
    expect(isDuplicateKeyError({ code: '23505', message: 'duplicate key value' })).toBe(true)
  })

  it('returns true when message contains "duplicate key"', () => {
    expect(
      isDuplicateKeyError({ message: 'ERROR: duplicate key value violates unique constraint' }),
    ).toBe(true)
  })

  it('returns true when message contains "unique constraint"', () => {
    expect(
      isDuplicateKeyError({
        message: 'unique constraint "orders_tenant_providerEventId_idx" violated',
      }),
    ).toBe(true)
  })

  it('returns false for a generic database error', () => {
    expect(isDuplicateKeyError({ code: '42P01', message: 'relation does not exist' })).toBe(false)
  })

  it('returns false for a plain Error object with unrelated message', () => {
    expect(isDuplicateKeyError(new Error('connection refused'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isDuplicateKeyError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isDuplicateKeyError(undefined)).toBe(false)
  })

  it('returns false for a non-object primitive', () => {
    expect(isDuplicateKeyError('duplicate key')).toBe(false)
  })
})
