/**
 * HMAC-SHA256 unsubscribe token for email marketing.
 *
 * Token format: `<base64url(payload)>.<hmacSHA256Hex(payload, key)>`
 * where payload = `<tenantId>:<contactId>`.
 *
 * Uses the same CREDENTIALS_ENCRYPTION_KEY env var as the encryption module
 * to avoid introducing a second secret.  The raw 32-byte key is used as the
 * HMAC secret, which is cryptographically appropriate.
 *
 * timingSafeEqual is used for the signature comparison to prevent timing
 * attacks.  Length is checked before the call to guard against non-hex input
 * that decodes to a different byte-length buffer (mirroring the Razorpay
 * adapter pattern in src/payments/providers/razorpay.ts).
 */
import { createHmac, timingSafeEqual } from 'crypto'

const HMAC_ALGO = 'sha256'
/** Expected hex-string length of an SHA-256 digest (32 bytes → 64 hex chars). */
const SIG_HEX_LEN = 64

function getKeyBuffer(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string. ' +
        'Generate one with: openssl rand -hex 32',
    )
  }
  return Buffer.from(hex, 'hex')
}

function computeHmac(payload: string, key: Buffer): string {
  return createHmac(HMAC_ALGO, key).update(payload).digest('hex')
}

/**
 * Sign an unsubscribe token for the given tenant + contact pair.
 * Returns a dot-separated string: `<base64url(payload)>.<hmac-hex>`.
 */
export function signUnsubscribe(tenantId: string, contactId: string): string {
  const payload = `${tenantId}:${contactId}`
  const key = getKeyBuffer()
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = computeHmac(payload, key)
  return `${encoded}.${sig}`
}

/**
 * Verify an unsubscribe token.
 * Returns `{ tenantId, contactId }` if the token is valid, or `null` if it
 * has been tampered with or is malformed.
 *
 * Never throws — all error paths return null.
 */
export function verifyUnsubscribe(token: string): { tenantId: string; contactId: string } | null {
  if (!token) return null

  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return null

  const encoded = token.slice(0, dotIdx)
  const receivedSig = token.slice(dotIdx + 1)

  // Guard: signature must be the correct hex length before we decode buffers.
  if (receivedSig.length !== SIG_HEX_LEN) return null
  // Guard: only allow hex characters in the signature to ensure the decoded
  // buffer is the expected 32 bytes (mirrors razorpay safeCompareSignatures).
  if (!/^[0-9a-fA-F]{64}$/.test(receivedSig)) return null

  let payload: string
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return null
  }

  let key: Buffer
  try {
    key = getKeyBuffer()
  } catch {
    return null
  }

  const expectedSig = computeHmac(payload, key)

  // Constant-time compare.  Both buffers are 32 bytes (64-hex → hex decode),
  // guaranteed by the length/hex guards above.
  const bufExpected = Buffer.from(expectedSig, 'hex')
  const bufReceived = Buffer.from(receivedSig, 'hex')
  if (bufExpected.length !== bufReceived.length) return null
  if (!timingSafeEqual(bufExpected, bufReceived)) return null

  // Parse payload
  const colonIdx = payload.indexOf(':')
  if (colonIdx === -1) return null

  const tenantId = payload.slice(0, colonIdx)
  const contactId = payload.slice(colonIdx + 1)
  if (!tenantId || !contactId) return null

  return { tenantId, contactId }
}
