import { beforeAll, describe, expect, it } from 'vitest'

// The plain `vitest run` (src/**/*.test.ts) config does not load .env.local —
// only the integration config does (vitest.setup.ts). Unit tests that touch a
// keyed module set the env var themselves, same as
// src/lib/marketing/unsubscribe-token.test.ts and src/lib/encryption.test.ts.
beforeAll(() => {
  process.env.GIFT_CARD_CODE_KEY = 'test-key-not-a-real-secret'
})

import { generateGiftCardCode, hashGiftCardCode } from './code'

describe('generateGiftCardCode', () => {
  it('returns a code and its last four characters', () => {
    const { code, last4 } = generateGiftCardCode()
    expect(code).toMatch(/^[0-9A-HJ-NP-Z]{16}$/)
    expect(last4).toBe(code.slice(-4))
  })

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateGiftCardCode().code))
    expect(seen.size).toBe(500)
  })
})

describe('hashGiftCardCode', () => {
  it('is deterministic, so a code can be looked up by hash', () => {
    expect(hashGiftCardCode('ABCD1234EFGH5678')).toBe(hashGiftCardCode('ABCD1234EFGH5678'))
  })

  it('differs for different codes', () => {
    expect(hashGiftCardCode('AAAA1111BBBB2222')).not.toBe(hashGiftCardCode('AAAA1111BBBB2223'))
  })

  it('never returns the plaintext', () => {
    const code = 'ABCD1234EFGH5678'
    expect(hashGiftCardCode(code)).not.toContain(code)
  })
})
