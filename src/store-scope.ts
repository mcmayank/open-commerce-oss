import type { Where } from 'payload'
import { extractTenantId } from '@/access/roles'
import { hostedScope } from '@/store-scope-overlay'

/**
 * How core scopes a query, a write, or a document to a store.
 *
 * Hosted: every store collection carries a `tenant` relationship (added by
 * withHosted), so `storeWhere(7)` is `{ tenant: { equals: 7 } }`, `storeRef(7)`
 * is `{ tenant: 7 }`, and `storeIdOf(doc)` reads `doc.tenant`. OSS: there is
 * one store and no tenant field, so the filter and the ref are empty and every
 * document belongs to store 1. Core never spells `tenant` itself.
 */
export function storeWhere(storeId: string | number): Where {
  return hostedScope ? { tenant: { equals: storeId } } : {}
}

/** Spread into `data` on create/update. */
export function storeRef(storeId: string | number): Record<string, unknown> {
  return hostedScope ? { tenant: storeId } : {}
}

/**
 * The store a document belongs to, whatever shape the relationship came back
 * in. Typed as `object` rather than `{ tenant?: unknown }` because the OSS
 * generated types have no `tenant` property at all, and TypeScript's weak-type
 * check would reject every document there.
 */
export function storeIdOf(doc: object | null | undefined): string | number | undefined {
  if (!hostedScope) return 1
  return extractTenantId((doc as { tenant?: unknown } | null | undefined)?.tenant)
}
