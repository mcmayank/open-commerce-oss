'use server'

import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getCurrentCustomer } from '@/lib/auth/session'

export type AddressState = { error?: string; success?: boolean } | null

/** Validate required address fields. Returns an error string or null. */
function validateAddress(data: {
  line1: string
  city: string
  postalCode: string
  country: string
}): string | null {
  if (!data.line1.trim()) return 'Address line 1 is required.'
  if (!data.city.trim()) return 'City is required.'
  if (!data.postalCode.trim()) return 'Postal code is required.'
  if (!data.country.trim()) return 'Country is required.'
  return null
}

export async function addAddress(
  _prev: AddressState,
  formData: FormData,
): Promise<AddressState> {
  // Always resolve customer from session — never trust form data for identity
  const customer = await getCurrentCustomer()
  if (!customer) return { error: 'You must be signed in to manage addresses.' }

  const line1 = String(formData.get('line1') ?? '').trim()
  const line2 = String(formData.get('line2') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  const state = String(formData.get('state') ?? '').trim()
  const postalCode = String(formData.get('postalCode') ?? '').trim()
  const country = String(formData.get('country') ?? '').trim()

  const validationError = validateAddress({ line1, city, postalCode, country })
  if (validationError) return { error: validationError }

  const existing = customer.addresses ?? []
  const newAddress = { line1, line2: line2 || null, city, state: state || null, postalCode, country }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { addresses: [...existing, newAddress] },
    overrideAccess: true,
  })

  // The proxy rewrites the user-facing /account/addresses to /store/{slug}/account/addresses,
  // so target the whole layout tree rather than a literal path that matches no cached route.
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateAddress(
  _prev: AddressState,
  formData: FormData,
): Promise<AddressState> {
  const customer = await getCurrentCustomer()
  if (!customer) return { error: 'You must be signed in to manage addresses.' }

  const index = Number(String(formData.get('index') ?? ''))

  const existing = customer.addresses ?? []
  // Validate index is a real integer within the session customer's own addresses array
  if (!Number.isInteger(index) || index < 0 || index >= existing.length) {
    return { error: 'Invalid address.' }
  }

  const line1 = String(formData.get('line1') ?? '').trim()
  const line2 = String(formData.get('line2') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  const state = String(formData.get('state') ?? '').trim()
  const postalCode = String(formData.get('postalCode') ?? '').trim()
  const country = String(formData.get('country') ?? '').trim()

  const validationError = validateAddress({ line1, city, postalCode, country })
  if (validationError) return { error: validationError }

  const updated = [...existing]
  updated[index] = { ...updated[index], line1, line2: line2 || null, city, state: state || null, postalCode, country }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { addresses: updated },
    overrideAccess: true,
  })

  // The proxy rewrites the user-facing /account/addresses to /store/{slug}/account/addresses,
  // so target the whole layout tree rather than a literal path that matches no cached route.
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeAddress(
  _prev: AddressState,
  formData: FormData,
): Promise<AddressState> {
  const customer = await getCurrentCustomer()
  if (!customer) return { error: 'You must be signed in to manage addresses.' }

  const index = Number(String(formData.get('index') ?? ''))

  const existing = customer.addresses ?? []
  if (!Number.isInteger(index) || index < 0 || index >= existing.length) {
    return { error: 'Invalid address.' }
  }

  const updated = existing.filter((_, i) => i !== index)

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { addresses: updated },
    overrideAccess: true,
  })

  // The proxy rewrites the user-facing /account/addresses to /store/{slug}/account/addresses,
  // so target the whole layout tree rather than a literal path that matches no cached route.
  revalidatePath('/', 'layout')
  return { success: true }
}
