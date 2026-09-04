import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('verifies the correct password', async () => {
    const h = await hashPassword('s3cret-pw')
    expect(await verifyPassword('s3cret-pw', h)).toBe(true)
  })
  it('rejects the wrong password', async () => {
    const h = await hashPassword('s3cret-pw')
    expect(await verifyPassword('wrong', h)).toBe(false)
  })
  it('produces a different hash each time (random salt)', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'))
  })
  it('returns false on a malformed stored value without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
  })
  it('dummy hash (128-hex, correct length) reaches scrypt and returns false — not a short-circuit', async () => {
    // This is the DUMMY_HASH shape used in the login action to prevent timing-based email enumeration.
    // verifyPassword must reach the scrypt call (expected.length === 64 passes the gate) and compare,
    // returning false because the derived key won't match the all-zero expected value.
    const dummyHash = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`
    expect(await verifyPassword('anything', dummyHash)).toBe(false)
  })
  it('too-short hash is rejected at the length gate (before scrypt)', async () => {
    // Salt and hash are both 4 hex chars (2 bytes each) — expected.length will be 2, not 64 (KEYLEN),
    // so verifyPassword returns false before scrypt runs (the short-circuit path).
    expect(await verifyPassword('anything', 'scrypt:0000:0000')).toBe(false)
  })
})
