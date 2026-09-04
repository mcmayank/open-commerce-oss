import type { Field } from 'payload'
import { decrypt, encrypt, isEncrypted } from '@/lib/encryption'

/**
 * A `text` field that stores a per-provider credential JSON object AES-256-GCM
 * encrypted at rest. The plaintext value is a JSON string (produced by
 * `encryptCredentials`'s caller / `JSON.stringify`); the field encrypts it.
 *
 * This is the blob analogue of `encryptedSecretField`: the credential schema is
 * dynamic per provider, so a single encrypted column is used instead of one
 * column per secret.
 *
 * **Read** — returns plaintext JSON ONLY when `context: { decryptSecrets: true }`;
 * otherwise returns null (never exposes ciphertext or plaintext). The value is
 * never rendered in the native admin UI (`hidden`); a custom Settings view owns
 * display and only ever emits a masked view.
 *
 * **Write** — empty value preserves the existing stored ciphertext (never
 * clobbers it); already-encrypted value passes through; plaintext is encrypted.
 */
export const encryptedCredentialBlobField = (name: string): Field => ({
  name,
  type: 'text',
  admin: { hidden: true, readOnly: true },
  hooks: {
    beforeChange: [
      ({ value, siblingDocWithLocales }) => {
        // Preserve existing ciphertext when nothing new is provided. Use the raw
        // pre-hook stored value (see encryptedSecretField for why not originalDoc).
        if (!value) {
          return (siblingDocWithLocales?.[name] as string | undefined) ?? null
        }
        if (isEncrypted(value)) return value
        return encrypt(value)
      },
    ],
    afterRead: [
      ({ value, context }) => {
        if (!value) return null
        if (context?.decryptSecrets === true && isEncrypted(value)) {
          return decrypt(value)
        }
        // Never expose ciphertext/plaintext in a normal read.
        return null
      },
    ],
  },
})
