'use server'

import { redirect } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreFromHost } from '@/lib/storefront'
import { peekResetToken, verifyReset } from '@/lib/auth/reset-token'
import { hashPassword } from '@/lib/auth/password'
import { storeWhere, storeIdOf } from '@/store-scope'

export type ResetState = { error: string } | null

export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')

  // 1. Validate new password length
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  // 2. Resolve tenant from host — never from form data
  const store = await resolveStoreFromHost()
  if (!store) return { error: 'This reset link is invalid or has expired.' }

  // 3. Peek the token (UNTRUSTED) to extract customerId for the DB lookup
  const peeked = peekResetToken(token)
  if (!peeked) return { error: 'This reset link is invalid or has expired.' }

  // 4. Fetch customer by id + tenant (tenant-scoped lookup + overrideAccess to get passwordHash)
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
    if (!customer) return { error: 'This reset link is invalid or has expired.' }
  } catch {
    return { error: 'This reset link is invalid or has expired.' }
  }

  // 5. Confirm the customer belongs to this store (tenant isolation)
  const customerTenantId =
    String(storeIdOf(customer))
  if (customerTenantId !== String(store.id)) {
    return { error: 'This reset link is invalid or has expired.' }
  }

  // 6. Verify the token — checks signature, expiry, AND single-use snapshot
  if (!customer.passwordHash) {
    return { error: 'This reset link is invalid or has expired.' }
  }
  const verified = verifyReset(token, customer.passwordHash)
  if (!verified) {
    return { error: 'This reset link is invalid or has expired.' }
  }

  // 7. Belt-and-suspenders: confirm tenantId in the token matches the store
  if (verified.tenantId !== String(store.id)) {
    return { error: 'This reset link is invalid or has expired.' }
  }

  // 8. Hash the new password and update — this changes passwordHash, invalidating the token (single-use)
  const newHash = await hashPassword(password)
  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { passwordHash: newHash },
    overrideAccess: true,
  })

  // 9. Redirect OUTSIDE any try/catch — redirect() throws NEXT_REDIRECT internally
  redirect('/account/login?reset=1')
}
