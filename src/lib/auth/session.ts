import { cache } from 'react'
import { hmacSign, hmacVerify } from './hmac'
import { cookieSecure } from '@/lib/cookies'
import { storeIdOf } from '@/store-scope'

export const SESSION_COOKIE = 'oc_customer_session'
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

// token = base64url(`${tenantId}:${customerId}:${exp}`).<hmac>
export function signSession(tenantId: string, customerId: string, ttlMs = DEFAULT_TTL): string {
  if (String(tenantId).includes(':') || String(customerId).includes(':')) {
    throw new Error('id must not contain ":"')
  }
  const payload = `${tenantId}:${customerId}:${Date.now() + ttlMs}`
  return `${Buffer.from(payload).toString('base64url')}.${hmacSign(payload)}`
}

export function verifySession(token: string): { tenantId: string; customerId: string } | null {
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
  const parts = payload.split(':')
  if (parts.length !== 3) return null
  const [tenantId, customerId, expStr] = parts
  const exp = Number(expStr)
  if (!tenantId || !customerId || !Number.isFinite(exp) || Date.now() > exp) return null
  return { tenantId, customerId }
}

export async function setSessionCookie(token: string, ttlMs = DEFAULT_TTL): Promise<void> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: Math.floor(ttlMs / 1000),
  })
}

export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * Resolve the logged-in customer for the current request, or null. Never throws.
 * Wrapped in React.cache so a single render (e.g. a page and its Header both
 * calling this) reads the session and hits the DB only once.
 */
export const getCurrentCustomer = cache(async () => {
  try {
    const { cookies } = await import('next/headers')
    const raw = (await cookies()).get(SESSION_COOKIE)?.value
    if (!raw) return null
    const parsed = verifySession(raw)
    if (!parsed) return null
    const { resolveStoreFromHost } = await import('@/lib/storefront')
    const store = await resolveStoreFromHost()
    if (!store || String(store.id) !== String(parsed.tenantId)) return null
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const customer = await payload.findByID({
      collection: 'customers',
      id: parsed.customerId,
      overrideAccess: true,
    })
    // Confirm the customer belongs to the resolved tenant
    if (!customer) return null
    const custTenant = storeIdOf(customer)
    if (String(custTenant) !== String(store.id)) return null
    // Strip secrets before returning — must never reach a caller or a Client Component prop
    // (field access is () => false in the collection but defence-in-depth).
    const { passwordHash: _passwordHash, magicLinkNonce: _magicLinkNonce, ...safe } = customer
    return safe
  } catch {
    return null
  }
})
