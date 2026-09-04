import { createHash } from 'crypto'
import { hmacSign, hmacVerify } from './hmac'

const snap = (passwordHash: string) =>
  createHash('sha256').update(passwordHash).digest('hex').slice(0, 16)

export function signReset(
  tenantId: string,
  customerId: string,
  passwordHash: string,
  ttlMs = 60 * 60 * 1000,
): string {
  if (String(tenantId).includes(':') || String(customerId).includes(':')) {
    throw new Error('id must not contain ":"')
  }
  const payload = `${tenantId}:${customerId}:${Date.now() + ttlMs}:${snap(passwordHash)}`
  return `${Buffer.from(payload).toString('base64url')}.${hmacSign(payload)}`
}

/**
 * Decode the token payload WITHOUT verifying the signature. UNTRUSTED — only used to look up
 * which customer to fetch; verifyReset() then does the real signature/expiry/single-use check.
 */
export function peekResetToken(token: string): { tenantId: string; customerId: string } | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 1) return null
    const encoded = token.slice(0, dot)
    let payload: string
    try {
      payload = Buffer.from(encoded, 'base64url').toString()
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

export function verifyReset(
  token: string,
  currentPasswordHash: string,
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
  if (tokenSnap !== snap(currentPasswordHash)) return null // single-use
  return { tenantId, customerId }
}
