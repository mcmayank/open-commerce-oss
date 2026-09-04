/**
 * upsertContact — idempotent contact intake helper.
 *
 * Rules:
 *  - Scoped by (tenant, email) — not global.
 *  - If the contact already exists (regardless of status), it is returned as-is.
 *    An unsubscribed contact is NEVER silently resubscribed by this helper.
 *  - If the contact does not exist, it is created with `status: 'subscribed'` and
 *    the supplied `source`.
 *  - `overrideAccess: true` is used throughout — callers must ensure they have the
 *    authority to write contacts for the given tenant.
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import type { Contact } from '@/payload-types'
import { storeWhere, storeRef } from '@/store-scope'

export interface UpsertContactInput {
  email: string
  name?: string
  source: 'checkout' | 'newsletter' | 'import' | 'manual'
  tags?: string[]
}

export async function upsertContact(
  tenantId: string | number,
  input: UpsertContactInput,
): Promise<Contact> {
  const payload = await getPayload({ config })

  // Find existing contact scoped to this tenant + email
  const { docs: existing } = await payload.find({
    collection: 'contacts',
    where: {
      and: [storeWhere(tenantId), { email: { equals: input.email } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing[0]) {
    // Return the existing contact unchanged — do NOT flip status.
    // An unsubscribed contact stays unsubscribed even if they re-submit a form.
    return existing[0]
  }

  // Create a new contact with subscribed status.
  // Payload 3 / PostgreSQL uses numeric IDs — coerce tenantId to number.
  const contact = await payload.create({
    collection: 'contacts',
    data: {
      ...storeRef(Number(tenantId)),
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
      source: input.source,
      status: 'subscribed',
    },
    overrideAccess: true,
  })

  return contact
}
