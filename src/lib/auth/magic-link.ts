import { createHash, randomBytes } from 'crypto'
import { hmacSign, hmacVerify } from './hmac'

const DEFAULT_TTL = 15 * 60 * 1000 // 15 minutes

// Truncated snapshot of a mutable per-customer value; rotating the value kills the token (single-use).
const snap = (nonce: string) => createHash('sha256').update(nonce).digest('hex').slice(0, 16)

/** Fresh 64-hex nonce to store on the customer when a link is issued/consumed. */
export function newMagicLinkNonce(): string {
  return randomBytes(32).toString('hex')
}

// token = base64url(`${tenantId}:${customerId}:${exp}:${snap(nonce)}`).<hmac>
export function signMagicLink(
  tenantId: string,
  customerId: string,
  nonce: string,
  ttlMs = DEFAULT_TTL,
): string {
  if (String(tenantId).includes(':') || String(customerId).includes(':')) {
    throw new Error('id must not contain ":"')
  }
  const payload = `${tenantId}:${customerId}:${Date.now() + ttlMs}:${snap(nonce)}`
  return `${Buffer.from(payload).toString('base64url')}.${hmacSign(payload)}`
}

/**
 * Decode ids WITHOUT verifying the signature. UNTRUSTED — only to look up which
 * customer to fetch; verifyMagicLink() then does the real signature/expiry/single-use check.
 */
export function peekMagicLink(token: string): { tenantId: string; customerId: string } | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 1) return null
    let payload: string
    try {
      payload = Buffer.from(token.slice(0, dot), 'base64url').toString()
    } catch {
      return null
    }
    const parts = payload.split(':')
    if (parts.length < 4) return null
    const [tenantId, customerId] = parts
    if (!tenantId || !customerId) return null
    return { tenantId, customerId }
  } catch {
    return null
  }
}

export function verifyMagicLink(
  token: string,
  currentNonce: string,
): { tenantId: string; customerId: string } | null {
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const encoded = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload: string
  try {
    payload = Buffer.from(encoded, 'base64url').toString()
  } catch {
    return null
  }
  if (!hmacVerify(payload, sig)) return null
  const [tenantId, customerId, expStr, tokenSnap] = payload.split(':')
  const exp = Number(expStr)
  if (!tenantId || !customerId || !tokenSnap || !Number.isFinite(exp) || Date.now() > exp) return null
  if (tokenSnap !== snap(currentNonce)) return null // single-use
  return { tenantId, customerId }
}
