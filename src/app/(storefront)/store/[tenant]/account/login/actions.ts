'use server'

import { redirect } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreFromHost } from '@/lib/storefront'
import { verifyPassword } from '@/lib/auth/password'
import { signSession, setSessionCookie } from '@/lib/auth/session'
import { storeWhere } from '@/store-scope'

// Dummy hash sized so verifyPassword runs scrypt even when no customer exists —
// keeps login response time independent of whether the email is registered (no enumeration).
// Salt = 16 bytes (32 hex chars), hash = 64 bytes (128 hex chars) — matches KEYLEN gate in verifyPassword.
const DUMMY_HASH = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`

export type LoginState = { error?: string } | null

export async function loginCustomer(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 1. Resolve tenant from host — never from form data
  const store = await resolveStoreFromHost()
  if (!store) return { error: 'Store not found.' }

  // 2. Read fields
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    return { error: 'Invalid email or password.' }
  }

  // 3. Find customer by (tenant, email) — overrideAccess so passwordHash is returned
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
  const customer = docs[0] ?? null

  // 4. Generic error for missing customer OR wrong password — no user enumeration
  // constant-work: always run a hash comparison so response time doesn't reveal whether the email exists
  const storedHash = customer?.passwordHash ?? DUMMY_HASH
  const passwordOk = await verifyPassword(password, storedHash)
  if (!customer || !customer.passwordHash || !passwordOk) {
    return { error: 'Invalid email or password.' }
  }

  // 5. Update lastLoginAt (overrideAccess required — field update access is () => false)
  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { lastLoginAt: new Date().toISOString() },
    overrideAccess: true,
  })

  // 6. Issue session cookie
  await setSessionCookie(signSession(String(store.id), String(customer.id)))

  // 7. Redirect OUTSIDE any try/catch (redirect() throws NEXT_REDIRECT internally)
  redirect('/account')
}
