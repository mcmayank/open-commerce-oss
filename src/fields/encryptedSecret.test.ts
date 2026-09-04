import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64)
})

import { encrypt, isEncrypted, decrypt } from '@/lib/encryption'
import { encryptedSecretField } from './encryptedSecret'

const MASK = '••••••••'

// Extract hooks from the field factory
function getHooks(fieldName = 'apiKey') {
  const field = encryptedSecretField(fieldName)
  const hooks = (field as any).hooks
  const beforeChange = hooks.beforeChange[0] as (args: any) => any
  const afterRead = hooks.afterRead[0] as (args: any) => any
  return { beforeChange, afterRead }
}

// ──────────────────────────────────────────────────────────────────────────────
// afterRead hook
// ──────────────────────────────────────────────────────────────────────────────

describe('encryptedSecretField – afterRead', () => {
  it('returns mask when context is absent and field has a stored value', () => {
    const { afterRead } = getHooks()
    const ciphertext = encrypt('sk_live_secret')
    expect(afterRead({ value: ciphertext, context: undefined })).toBe(MASK)
  })

  it('returns mask when context.decryptSecrets is false', () => {
    const { afterRead } = getHooks()
    const ciphertext = encrypt('sk_live_secret')
    expect(afterRead({ value: ciphertext, context: { decryptSecrets: false } })).toBe(MASK)
  })

  it('returns mask when context.decryptSecrets is absent', () => {
    const { afterRead } = getHooks()
    const ciphertext = encrypt('sk_live_secret')
    expect(afterRead({ value: ciphertext, context: {} })).toBe(MASK)
  })

  it('returns decrypted plaintext when context.decryptSecrets is true and value is encrypted', () => {
    const { afterRead } = getHooks()
    const plaintext = 'sk_live_secret'
    const ciphertext = encrypt(plaintext)
    const result = afterRead({ value: ciphertext, context: { decryptSecrets: true } })
    expect(result).toBe(plaintext)
  })

  it('returns null when value is null/undefined/empty (field never configured)', () => {
    const { afterRead } = getHooks()
    expect(afterRead({ value: null, context: undefined })).toBeNull()
    expect(afterRead({ value: undefined, context: undefined })).toBeNull()
    expect(afterRead({ value: '', context: undefined })).toBeNull()
  })

  it('returns null (not mask) for unset field even when decryptSecrets is true', () => {
    const { afterRead } = getHooks()
    expect(afterRead({ value: null, context: { decryptSecrets: true } })).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// beforeChange hook
// ──────────────────────────────────────────────────────────────────────────────

describe('encryptedSecretField – beforeChange', () => {
  it('encrypts a new plaintext value', () => {
    const { beforeChange } = getHooks()
    const result = beforeChange({ value: 'sk_live_newkey', siblingDocWithLocales: undefined })
    expect(isEncrypted(result)).toBe(true)
    expect(decrypt(result)).toBe('sk_live_newkey')
  })

  it('no-clobber: mask sentinel + siblingDocWithLocales with stored ciphertext → returns same ciphertext unchanged', () => {
    const { beforeChange } = getHooks('apiKey')
    const storedCiphertext = encrypt('sk_live_original')
    // This is the critical regression test — with the old `originalDoc` code the
    // hook would have returned the mask '••••••••' (because originalDoc[name]
    // is the afterRead-masked value), permanently destroying the secret.
    const result = beforeChange({
      value: MASK,
      siblingDocWithLocales: { apiKey: storedCiphertext },
    })
    expect(result).toBe(storedCiphertext)
  })

  it('no-clobber: empty string + siblingDocWithLocales with stored ciphertext → returns same ciphertext unchanged', () => {
    const { beforeChange } = getHooks('apiKey')
    const storedCiphertext = encrypt('sk_live_original')
    const result = beforeChange({
      value: '',
      siblingDocWithLocales: { apiKey: storedCiphertext },
    })
    expect(result).toBe(storedCiphertext)
  })

  it('on CREATE: mask/empty value with no siblingDocWithLocales → returns empty string (does not store mask)', () => {
    const { beforeChange } = getHooks()
    expect(beforeChange({ value: MASK, siblingDocWithLocales: undefined })).toBe('')
    expect(beforeChange({ value: '', siblingDocWithLocales: undefined })).toBe('')
    expect(beforeChange({ value: undefined, siblingDocWithLocales: undefined })).toBe('')
  })

  it('does not double-encrypt an already-encrypted value', () => {
    const { beforeChange } = getHooks()
    const ciphertext = encrypt('sk_live_secret')
    const result = beforeChange({ value: ciphertext, siblingDocWithLocales: undefined })
    // Must come back as-is (single layer), still decryptable
    expect(result).toBe(ciphertext)
    expect(decrypt(result)).toBe('sk_live_secret')
  })
})
