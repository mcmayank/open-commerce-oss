/**
 * Credential encryption for payment providers.
 *
 * Wraps the existing app-level AES-256-GCM primitive (`@/lib/encryption`) — we
 * do NOT reimplement crypto here. Credentials are a per-provider JSON object
 * (`{ secretKey, keyId, webhookSecret, ... }`) stored as a single encrypted blob.
 *
 * Fail closed: any decryption / auth-tag / parse failure throws
 * `CREDENTIAL_DECRYPTION_FAILED` — no fallback, no partial config.
 */

import { decrypt, encrypt, isEncrypted } from '@/lib/encryption'
import { PaymentError } from '@/payments/core/errors'
import type { CredentialSchema, Credentials } from '@/payments/core/types'

/** Mask sentinel used by the Settings UI to mean "keep the existing secret". */
export const CREDENTIAL_MASK = '••••••••'

/** Encrypt a credential object into a versioned ciphertext blob. */
export function encryptCredentials(creds: Credentials): string {
  return encrypt(JSON.stringify(creds))
}

/** Decrypt a credential blob. Throws `CREDENTIAL_DECRYPTION_FAILED` on any failure. */
export function decryptCredentials(blob: string): Credentials {
  try {
    const json = isEncrypted(blob) ? decrypt(blob) : blob
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('credential blob is not an object')
    }
    return parsed as Credentials
  } catch {
    // Never surface the underlying error (may leak ciphertext/keys).
    throw new PaymentError('CREDENTIAL_DECRYPTION_FAILED')
  }
}

/**
 * Merge incoming credential edits over the existing decrypted credentials.
 * For `secret` fields a blank / masked incoming value means "keep the existing
 * secret" (so the merchant never has to re-enter a key to change a non-secret
 * setting). Non-secret fields always take the incoming value.
 */
export function mergeCredentials(
  schema: CredentialSchema,
  existing: Credentials,
  incoming: Credentials,
): Credentials {
  const merged: Credentials = { ...existing }
  for (const field of schema) {
    const val = incoming[field.name]
    if (field.secret) {
      if (val && val !== CREDENTIAL_MASK) merged[field.name] = val
      // blank / mask → keep existing secret
    } else if (val !== undefined) {
      merged[field.name] = val
    }
  }
  return merged
}

/** A client-safe view: secret fields become an "is configured" flag, never the value. */
export type MaskedCredentials = Record<string, { configured: boolean; value?: string }>

/**
 * Produce a client-safe view of stored credentials. Secret values are reduced
 * to a boolean `configured` flag and NEVER included. Non-secret values
 * (e.g. publishable keys, `key_id`) are safe to expose.
 */
export function maskCredentials(schema: CredentialSchema, creds: Credentials): MaskedCredentials {
  const out: MaskedCredentials = {}
  for (const field of schema) {
    const val = creds[field.name]
    out[field.name] = field.secret
      ? { configured: Boolean(val) }
      : { configured: Boolean(val), value: val ?? '' }
  }
  return out
}
