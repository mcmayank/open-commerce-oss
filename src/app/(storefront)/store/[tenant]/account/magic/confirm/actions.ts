'use server'

import { redirect } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreFromHost } from '@/lib/storefront'
import { peekMagicLink, verifyMagicLink, newMagicLinkNonce } from '@/lib/auth/magic-link'
import { signSession, setSessionCookie } from '@/lib/auth/session'
import { storeWhere, storeIdOf } from '@/store-scope'

export type ConsumeState = { error: string } | null

const INVALID = 'This sign-in link is invalid or has expired.'

export async function consumeMagicLink(
  _prev: ConsumeState,
  formData: FormData,
): Promise<ConsumeState> {
  const token = String(formData.get('token') ?? '')

  // 1. Resolve tenant from host — never from the token
  const store = await resolveStoreFromHost()
  if (!store) return { error: INVALID }

  // 2. Peek (UNTRUSTED) to find which customer to load
  const peeked = peekMagicLink(token)
  if (!peeked) return { error: INVALID }

  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customer: any
  try {
    const found = await payload.find({
      collection: 'customers',
      where: { and: [{ id: { equals: peeked.customerId } }, storeWhere(store.id)] },
      limit: 1,
      overrideAccess: true,
    })
    customer = found.docs[0]
  } catch {
    return { error: INVALID }
  }
  if (!customer || !customer.magicLinkNonce) return { error: INVALID }

  // 3. Tenant isolation (defense in depth)
  const customerTenantId =
    String(storeIdOf(customer))
  if (customerTenantId !== String(store.id)) return { error: INVALID }

  // 4. Verify signature + expiry + single-use nonce snapshot
  const verified = verifyMagicLink(token, customer.magicLinkNonce)
  if (!verified || verified.tenantId !== String(store.id)) return { error: INVALID }

  // 5. Rotate the nonce (kills this token) and stamp lastLoginAt — single-use is now enforced in the DB
  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { magicLinkNonce: newMagicLinkNonce(), lastLoginAt: new Date().toISOString() },
    overrideAccess: true,
  })

  // 6. Issue the session cookie (default 30-day, same as password login)
  await setSessionCookie(signSession(String(store.id), String(customer.id)))

  // 7. Redirect OUTSIDE any try/catch
  redirect('/account')
}
