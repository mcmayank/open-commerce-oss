import { beforeAll, describe, expect, it } from 'vitest'
beforeAll(() => { process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64) })
import { signReset, verifyReset, peekResetToken } from './reset-token'

const PW = 'scrypt:aa:bb'

describe('reset token', () => {
  it('round-trips when the password hash is unchanged', () => {
    const t = signReset('2', '5', PW, 3_600_000)
    expect(verifyReset(t, PW)).toEqual({ tenantId: '2', customerId: '5' })
  })
  it('is single-use: invalid once the password hash changes', () => {
    const t = signReset('2', '5', PW, 3_600_000)
    expect(verifyReset(t, 'scrypt:cc:dd')).toBeNull()
  })
  it('rejects expired', () => {
    expect(verifyReset(signReset('2', '5', PW, -1), PW)).toBeNull()
  })
  it('rejects tampered/garbage', () => {
    const t = signReset('2', '5', PW, 3_600_000)
    expect(verifyReset(t.slice(0, -2) + 'zz', PW)).toBeNull()
    expect(verifyReset('nope', PW)).toBeNull()
  })
})

describe('peekResetToken', () => {
  it('peeks tenantId and customerId from a valid token without verifying', () => {
    const t = signReset('3', '7', PW, 3_600_000)
    expect(peekResetToken(t)).toEqual({ tenantId: '3', customerId: '7' })
  })
  it('returns null for garbage strings', () => {
    expect(peekResetToken('garbage')).toBeNull()
    expect(peekResetToken('')).toBeNull()
    expect(peekResetToken('nodot')).toBeNull()
  })
  it('returns null when encoded part decodes to too-few segments', () => {
    // base64url-encode a payload with fewer than 4 colon-separated segments
    const short = Buffer.from('only:three').toString('base64url')
    expect(peekResetToken(`${short}.fakesig`)).toBeNull()
  })
  it('never throws on arbitrary input', () => {
    expect(() => peekResetToken('not-a-token!@#$%')).not.toThrow()
    expect(() => peekResetToken('')).not.toThrow()
    expect(() => peekResetToken('a'.repeat(1000))).not.toThrow()
  })
})
