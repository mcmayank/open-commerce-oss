import type { Where } from 'payload'
import { storeWhere } from '@/store-scope'

export interface AudienceConfig {
  mode: 'all' | 'tag' | 'source'
  tag?: string
  source?: string
}

/**
 * Build a Payload `Where` clause that filters contacts for a campaign audience.
 *
 * HARD INVARIANTS (enforced in every branch, NEVER relaxed):
 *  1. `storeWhere(tenantId)` — always tenant-scoped
 *  2. `{ status: { equals: 'subscribed' } }` — unsubscribed contacts must NEVER match
 *
 * mode:'all'    → only the two hard invariant clauses
 * mode:'tag'    → + `{ tags: { contains: tag } }` (falls back to 'all' if tag is missing/empty)
 * mode:'source' → + `{ source: { equals: source } }` (falls back to 'all' if source is missing/empty)
 */
export function buildAudienceWhere(tenantId: string, audience: AudienceConfig): Where {
  const baseClauses: Where[] = [
    storeWhere(tenantId),
    { status: { equals: 'subscribed' } },
  ]

  if (audience.mode === 'tag' && audience.tag) {
    return { and: [...baseClauses, { tags: { contains: audience.tag } }] }
  }

  if (audience.mode === 'source' && audience.source) {
    return { and: [...baseClauses, { source: { equals: audience.source } }] }
  }

  // mode:'all', or tag/source mode with missing value → fall back to all-subscribed
  return { and: baseClauses }
}
