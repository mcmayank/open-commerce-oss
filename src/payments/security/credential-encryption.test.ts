import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64)
})

import {
  CREDENTIAL_MASK,
  decryptCredentials,
  encryptCredentials,
  maskCredentials,
  mergeCredentials,
} from './credential-encryption'
import type { CredentialSchema } from '@/payments/core/types'
import { isPaymentError } from '@/payments/core/errors'

const SCHEMA: CredentialSchema = [
  { name: 'keyId', label: 'Key ID', type: 'text' },
  { name: 'secretKey', label: 'Secret key', type: 'secret', secret: true },
  { name: 'webhookSecret', label: 'Webhook secret', type: 'secret', secret: true },
]

describe('encrypt/decrypt round trip', () => {
  it('round-trips a credential object', () => {
    const creds = { keyId: 'pk_123', secretKey: 'sk_abc', webhookSecret: 'whsec_x' }
    const blob = encryptCredentials(creds)
    expect(blob.startsWith('enc:v1:')).toBe(true)
    expect(decryptCredentials(blob)).toEqual(creds)
  })

  it('fails closed with CREDENTIAL_DECRYPTION_FAILED on a tampered auth tag', () => {
    const blob = encryptCredentials({ secretKey: 'sk_live_secret' })
    const tampered = blob.slice(0, -2) + (blob.endsWith('AA') ? 'BB' : 'AA')
    try {
      decryptCredentials(tampered)
      throw new Error('expected decryptCredentials to throw')
    } catch (err) {
      expect(isPaymentError(err)).toBe(true)
      expect((err as { code: string }).code).toBe('CREDENTIAL_DECRYPTION_FAILED')
    }
  })

  it('fails closed on non-JSON / non-object payloads', () => {
    // A validly-encrypted but non-object plaintext must still be rejected.
    const notAnObject = encryptCredentials(['a'] as unknown as Record<string, string>)
    expect(() => decryptCredentials(notAnObject)).toThrow()
  })
})

describe('mergeCredentials', () => {
  it('keeps the existing secret when the incoming secret is blank or masked', () => {
    const existing = { keyId: 'pk_old', secretKey: 'sk_old', webhookSecret: 'wh_old' }
    const incoming = { keyId: 'pk_new', secretKey: '', webhookSecret: CREDENTIAL_MASK }
    expect(mergeCredentials(SCHEMA, existing, incoming)).toEqual({
      keyId: 'pk_new',
      secretKey: 'sk_old',
      webhookSecret: 'wh_old',
    })
  })

  it('replaces a secret when a new value is provided', () => {
    const existing = { secretKey: 'sk_old' }
    const incoming = { secretKey: 'sk_new' }
    expect(mergeCredentials(SCHEMA, existing, incoming).secretKey).toBe('sk_new')
  })
})

describe('maskCredentials', () => {
  it('reduces secret fields to a configured flag and never leaks the value', () => {
    const masked = maskCredentials(SCHEMA, {
      keyId: 'pk_123',
      secretKey: 'sk_super_secret',
      webhookSecret: '',
    })
    expect(masked.keyId).toEqual({ configured: true, value: 'pk_123' })
    expect(masked.secretKey).toEqual({ configured: true })
    expect(masked.secretKey.value).toBeUndefined()
    expect(masked.webhookSecret).toEqual({ configured: false })
    // Ensure no secret value is present anywhere in the serialized output.
    expect(JSON.stringify(masked)).not.toContain('sk_super_secret')
  })
})
