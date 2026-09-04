import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const CIPHER = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ` +
        `Generate one with: openssl rand -hex 32`,
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY contains non-hex characters. ` +
        `It must be exactly 64 hexadecimal digits (0-9, a-f). ` +
        `Generate one with: openssl rand -hex 32`,
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts plaintext using AES-256-GCM with a random 12-byte IV.
 *
 * Output format: `enc:v1:<base64(iv[12] || authTag[16] || ciphertext)>`
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(CIPHER, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Layout: iv (12 bytes) || authTag (16 bytes) || ciphertext
  const combined = Buffer.concat([iv, tag, encrypted])
  return PREFIX + combined.toString('base64')
}

/**
 * Decrypts a ciphertext produced by `encrypt`. Throws if the GCM auth tag
 * is invalid (tampered data) or the format is unexpected.
 */
export function decrypt(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) {
    throw new Error('decrypt: value does not have the expected enc:v1: prefix')
  }
  const key = getKey()
  const combined = Buffer.from(ciphertext.slice(PREFIX.length), 'base64')

  if (combined.length < IV_BYTES + TAG_BYTES) {
    throw new Error('decrypt: ciphertext is too short to be valid')
  }

  const iv = combined.subarray(0, IV_BYTES)
  const tag = combined.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const encrypted = combined.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv(CIPHER, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * Returns `true` if the value looks like an encrypted secret (has the
 * `enc:v1:` prefix). Use this to avoid double-encrypting a stored value.
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}
