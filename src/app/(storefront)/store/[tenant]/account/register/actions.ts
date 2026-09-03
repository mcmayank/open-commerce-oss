'use server'

import { redirect } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreFromHost } from '@/lib/storefront'
import { hashPassword } from '@/lib/auth/password'
import { signSession, setSessionCookie } from '@/lib/auth/session'
import { classifyRegistration } from '@/lib/auth/register'
import { storeWhere, storeRef } from '@/store-scope'

export type RegisterState = { error?: string } | null

export async function registerCustomer(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // 1. Resolve tenant from host — never from form data
  const store = await resolveStoreFromHost()
  if (!store) return { error: 'Store not found.' }

  // 2. Validate inputs
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'A valid email address is required.' }
  }
  if (!name) {
    return { error: 'Your name is required.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  // 3. Look up existing customer by (tenant, email) — overrideAccess so passwordHash is returned
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'customers',
    where: {
      and: [
        storeWhere(store.id),
        { email: { equals: email } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const existing = docs[0] ?? null

  // 4. Decide what to do
  const action = classifyRegistration(existing)

  if (action === 'exists') {
    return { error: 'An account with this email already exists. Please sign in.' }
  }

  const hashed = await hashPassword(password)
  let customerId: number

  if (action === 'claim') {
    // Guest customer from a prior checkout — give them a password + update name
    const updated = await payload.update({
      collection: 'customers',
      id: existing!.id,
      data: { passwordHash: hashed, name },
      overrideAccess: true,
    })
    customerId = updated.id
  } else {
    // 'create' — brand new customer
    const created = await payload.create({
      collection: 'customers',
      data: { ...storeRef(store.id), email, name, passwordHash: hashed },
      overrideAccess: true,
    })
    customerId = created.id
  }

  // 5. Issue session cookie
  await setSessionCookie(signSession(String(store.id), String(customerId)))

  // 6. Redirect OUTSIDE any try/catch (redirect() throws NEXT_REDIRECT internally)
  redirect('/account')
}
