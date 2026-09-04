'use server'

import { headers } from 'next/headers'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreFromHost, getStoreSettings } from '@/lib/storefront'
import { signReset } from '@/lib/auth/reset-token'
import { sendPasswordReset } from '@/lib/email'
import { storeWhere } from '@/store-scope'

export type ForgotState = { ok: true; message: string } | { ok?: false; error?: string } | null

const SUCCESS_MSG = "If that email exists, we've sent a reset link."

export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  // 1. Resolve tenant from host — never enumerate; always return success message
  const store = await resolveStoreFromHost()
  if (!store) return { ok: true, message: SUCCESS_MSG }

  // 2. Read + normalise email
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: true, message: SUCCESS_MSG }
  }

  try {
    // 3. Find customer by (tenant, email) WITH passwordHash
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

    // 4. Only send if customer exists AND has a passwordHash (registered, not guest-only)
    if (customer && customer.passwordHash) {
      const headerStore = await headers()
      const host = headerStore.get('host') ?? 'localhost'
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const token = signReset(String(store.id), String(customer.id), customer.passwordHash)
      const resetUrl = `${protocol}://${host}/account/reset?token=${token}`

      const settings = await getStoreSettings(store.id)
      const storeName = settings?.storeName ?? store.name

      await sendPasswordReset(email, resetUrl, storeName)
    }
  } catch (err) {
    // Log but never expose internals — still return the generic success message
    console.error('[forgot] requestReset error:', err)
  }

  // 5. Always return the same message — no enumeration
  return { ok: true, message: SUCCESS_MSG }
}
