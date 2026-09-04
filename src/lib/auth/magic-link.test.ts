import { beforeAll, describe, expect, it } from 'vitest'
beforeAll(() => { process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64) })
import { newMagicLinkNonce, signMagicLink, verifyMagicLink, peekMagicLink } from './magic-link'

const NONCE = 'a'.repeat(64)

describe('newMagicLinkNonce', () => {
  it('returns a 64-char hex string and differs each call', () => {
    const a = newMagicLinkNonce()
    const b = newMagicLinkNonce()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toEqual(b)
  })
})

describe('magic link token', () => {
  it('round-trips when the nonce is unchanged', () => {
    const t = signMagicLink('2', '5', NONCE)
    expect(verifyMagicLink(t, NONCE)).toEqual({ tenantId: '2', customerId: '5' })
  })
  it('is single-use: invalid once the nonce is rotated', () => {
    const t = signMagicLink('2', '5', NONCE)
    expect(verifyMagicLink(t, newMagicLinkNonce())).toBeNull()
  })
  it('rejects expired', () => {
    expect(verifyMagicLink(signMagicLink('2', '5', NONCE, -1), NONCE)).toBeNull()
  })
  it('rejects tampered/garbage', () => {
    const t = signMagicLink('2', '5', NONCE)
    expect(verifyMagicLink(t.slice(0, -2) + 'zz', NONCE)).toBeNull()
    expect(verifyMagicLink('nope', NONCE)).toBeNull()
  })
  it('throws if an id contains a colon', () => {
    expect(() => signMagicLink('2:x', '5', NONCE)).toThrow()
  })
})

describe('peekMagicLink', () => {
  it('peeks ids from a valid token without verifying', () => {
    const t = signMagicLink('3', '7', NONCE)
    expect(peekMagicLink(t)).toEqual({ tenantId: '3', customerId: '7' })
  })
  it('returns null for garbage and never throws', () => {
    expect(peekMagicLink('garbage')).toBeNull()
    expect(peekMagicLink('')).toBeNull()
    expect(() => peekMagicLink('a'.repeat(1000))).not.toThrow()
  })
})
