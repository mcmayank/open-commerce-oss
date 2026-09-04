'use server'

import { headers } from 'next/headers'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolveStoreFromHost, getStoreSettings } from '@/lib/storefront'
import { newMagicLinkNonce, signMagicLink } from '@/lib/auth/magic-link'
import { sendMagicLink } from '@/lib/email'
import { storeWhere } from '@/store-scope'

export type MagicRequestState = { ok: true; message: string } | { ok?: false; error?: string } | null

const SUCCESS_MSG = "If that email is registered, we've sent a sign-in link."

export async function requestMagicLink(
  _prev: MagicRequestState,
  formData: FormData,
): Promise<MagicRequestState> {
  const store = await resolveStoreFromHost()
  if (!store) return { ok: true, message: SUCCESS_MSG }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: true, message: SUCCESS_MSG }
  }

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'customers',
      where: { and: [storeWhere(store.id), { email: { equals: email } }] },
      limit: 1,
      overrideAccess: true,
    })
    const customer = docs[0] ?? null

    // Login-only: only registered customers get a link. Rotate nonce on issue so a
    // previously emailed link is invalidated (only the most recent link is valid).
    if (customer) {
      const nonce = newMagicLinkNonce()
      await payload.update({
        collection: 'customers',
        id: customer.id,
        data: { magicLinkNonce: nonce },
        overrideAccess: true,
      })

      const headerStore = await headers()
      const host = headerStore.get('host') ?? 'localhost'
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const token = signMagicLink(String(store.id), String(customer.id), nonce)
      const magicUrl = `${protocol}://${host}/account/magic/confirm?token=${token}`

      const settings = await getStoreSettings(store.id)
      const storeName = settings?.storeName ?? store.name
      await sendMagicLink(email, magicUrl, storeName)
    }
  } catch (err) {
    console.error('[magic] requestMagicLink error:', err)
  }

  return { ok: true, message: SUCCESS_MSG }
}
