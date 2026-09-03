import { beforeAll, afterEach, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64)
})

import { decrypt, encrypt, isEncrypted } from './encryption'

describe('encrypt/decrypt', () => {
  it('round-trips', () => {
    const s = 'sk_test_abc123'
    expect(decrypt(encrypt(s))).toBe(s)
  })

  it('produces different ciphertext each call (random IV)', () => {
    expect(encrypt('x')).not.toBe(encrypt('x'))
  })

  it('isEncrypted distinguishes ciphertext from plaintext', () => {
    expect(isEncrypted(encrypt('x'))).toBe(true)
    expect(isEncrypted('sk_test_plain')).toBe(false)
  })

  it('rejects tampered ciphertext', () => {
    const c = encrypt('secret')
    const tampered = c.slice(0, -2) + (c.endsWith('AA') ? 'BB' : 'AA')
    expect(() => decrypt(tampered)).toThrow()
  })
})

describe('getKey validation', () => {
  const original = process.env.CREDENTIALS_ENCRYPTION_KEY

  afterEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = original
  })

  it('throws for a 64-char non-hex value (e.g. all Z characters)', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'Z'.repeat(64)
    expect(() => encrypt('test')).toThrow(/non-hex/i)
  })

  it('throws a clear error when the key is missing', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
  })

  it('throws a clear error when the key is too short', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'abc123'
    expect(() => encrypt('test')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
  })
})
