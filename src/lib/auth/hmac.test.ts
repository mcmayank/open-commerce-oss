import { beforeAll, describe, expect, it } from 'vitest'
beforeAll(() => { process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64) })
import { hmacSign, hmacVerify } from './hmac'

describe('hmac', () => {
  it('verifies a genuine signature', () => {
    const sig = hmacSign('a:b:c')
    expect(hmacVerify('a:b:c', sig)).toBe(true)
  })
  it('rejects a tampered payload', () => {
    const sig = hmacSign('a:b:c')
    expect(hmacVerify('a:b:X', sig)).toBe(false)
  })
  it('rejects a tampered/short/non-hex signature without throwing', () => {
    expect(hmacVerify('a:b:c', 'deadbeef')).toBe(false)
    expect(hmacVerify('a:b:c', 'zz')).toBe(false)
    expect(hmacVerify('a:b:c', '')).toBe(false)
    expect(hmacVerify('a:b:c', 'z'.repeat(64))).toBe(false)
  })
})
