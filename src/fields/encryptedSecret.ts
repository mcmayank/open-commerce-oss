import type { Field } from 'payload'
import { decrypt, encrypt, isEncrypted } from '@/lib/encryption'

const MASK = '••••••••'

/**
 * Returns a Payload `text` field that stores the value AES-256-GCM encrypted
 * at rest and masks it in normal reads.
 *
 * **Read behaviour**
 * - Normal read → returns `'••••••••'` (never exposes ciphertext or plaintext).
 * - Read with `context: { decryptSecrets: true }` → returns the decrypted plaintext.
 *
 * **Write behaviour**
 * - Empty value or the mask sentinel `'••••••••'` → keeps the existing stored value unchanged.
 * - Value already encrypted (has `enc:v1:` prefix) → stored as-is (idempotent).
 * - Any other value → encrypted with AES-256-GCM before storing.
 */
export const encryptedSecretField = (name: string): Field => ({
  name,
  type: 'text',
  admin: {
    description:
      'Paste your payment-gateway secret key here. ' +
      'For Stripe, use a restricted key starting with `rk_` (not your live secret key). ' +
      'The value is encrypted at rest and will be masked after saving — ' +
      'paste a new value to rotate the key.',
  },
  hooks: {
    beforeChange: [
      ({ value, siblingDocWithLocales }) => {
        // If the incoming value is empty or the mask sentinel, preserve the existing
        // stored ciphertext from the raw pre-hook document data (do not clobber it).
        // NOTE: We use `siblingDocWithLocales` (the raw stored value before any hooks
        // run) rather than `originalDoc` — `originalDoc` has already gone through the
        // afterRead pipeline, so `originalDoc[name]` would be the mask sentinel
        // '••••••••' instead of the actual ciphertext, permanently destroying the key.
        if (!value || value === MASK) {
          return (siblingDocWithLocales?.[name] as string | undefined) ?? ''
        }
        // Already encrypted (e.g. during an internal re-save): pass through.
        if (isEncrypted(value)) {
          return value
        }
        // Plaintext: encrypt and store.
        return encrypt(value)
      },
    ],
    afterRead: [
      ({ value, context }) => {
        // If the field has never been configured, return null so callers can
        // distinguish "not configured" from "configured but hidden".
        if (!value) {
          return null
        }
        // Decrypt only when the caller explicitly requests it.
        if (context?.decryptSecrets === true && isEncrypted(value)) {
          return decrypt(value)
        }
        // Always mask — never expose ciphertext or plaintext in normal reads.
        return MASK
      },
    ],
  },
})
