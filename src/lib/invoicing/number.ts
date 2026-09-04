import type { Payload } from 'payload'
import { storeWhere } from '@/store-scope'

/** e.g. 42 -> "INV-00042". Pads to at least 5 digits. */
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(5, '0')}`
}

/**
 * Take the tenant's current invoice counter and increment it (best-effort atomic).
 * Returns the formatted number for the value that was taken.
 */
export async function allocateInvoiceNumber(payload: Payload, tenantId: string | number): Promise<string> {
  const { docs } = await payload.find({
    collection: 'store-settings',
    where: storeWhere(tenantId),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const settings = docs[0]
  if (!settings) {
    throw new Error(`Cannot allocate invoice number: no store-settings for tenant ${tenantId}`)
  }
  const current = typeof settings.nextInvoiceNumber === 'number' && settings.nextInvoiceNumber > 0
    ? settings.nextInvoiceNumber
    : 1
  await payload.update({
    collection: 'store-settings',
    id: settings.id,
    data: { nextInvoiceNumber: current + 1 },
    overrideAccess: true,
  })
  return formatInvoiceNumber(current)
}
