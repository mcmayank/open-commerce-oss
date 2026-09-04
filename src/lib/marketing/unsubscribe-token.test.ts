import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64)
})

// Import after setting env so the module can read the key on first call
import { signUnsubscribe, verifyUnsubscribe } from './unsubscribe-token'

describe('signUnsubscribe / verifyUnsubscribe', () => {
  it('round-trips tenantId and contactId', () => {
    const token = signUnsubscribe('tenant-abc', 'contact-123')
    expect(verifyUnsubscribe(token)).toEqual({ tenantId: 'tenant-abc', contactId: 'contact-123' })
  })

  it('round-trips with numeric-like ids', () => {
    const token = signUnsubscribe('1', '42')
    expect(verifyUnsubscribe(token)).toEqual({ tenantId: '1', contactId: '42' })
  })

  it('returns null for a tampered payload', () => {
    const token = signUnsubscribe('tenant-abc', 'contact-123')
    const [_payload, sig] = token.split('.')
    // Swap to a different payload (different tenantId)
    const tamperedPayload = Buffer.from('tenant-evil:contact-123').toString('base64url')
    expect(verifyUnsubscribe(`${tamperedPayload}.${sig}`)).toBeNull()
  })

  it('returns null for a tampered signature', () => {
    const token = signUnsubscribe('tenant-abc', 'contact-123')
    const [payload] = token.split('.')
    // Produce a valid-looking 64-hex signature but wrong
    const badSig = 'a'.repeat(64)
    expect(verifyUnsubscribe(`${payload}.${badSig}`)).toBeNull()
  })

  it('returns null when there is no dot separator (malformed)', () => {
    expect(verifyUnsubscribe('nodot')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(verifyUnsubscribe('')).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(verifyUnsubscribe('!!!.???')).toBeNull()
  })

  it('returns null for a non-hex signature (prevents timingSafeEqual throw)', () => {
    const token = signUnsubscribe('tenant-abc', 'contact-123')
    const [payload] = token.split('.')
    // Non-hex sig would decode to wrong length; must not throw
    expect(verifyUnsubscribe(`${payload}.notahexsig`)).toBeNull()
  })

  it('returns null for a signature of wrong length', () => {
    const token = signUnsubscribe('tenant-abc', 'contact-123')
    const [payload] = token.split('.')
    expect(verifyUnsubscribe(`${payload}.deadbeef`)).toBeNull()
  })
})
