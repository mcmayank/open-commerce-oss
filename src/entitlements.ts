/**
 * What is this store allowed to do?
 *
 * Core asks this one question instead of reading plans. The limit fields are
 * exactly `PlanLimits` (src/lib/plans.ts) so the hosted overlay maps a plan
 * onto them 1:1; `label` and `canUpgrade` carry the plan-specific copy that
 * quota errors and admin meters show ("Your Free plan is limited to…"), so
 * hosted messages are unchanged while core never names a plan itself. In the
 * OSS build the overlay is the identity and every store gets `EVERYTHING`.
 *
 * Callers must not import plans, plan limits or the plan resolver directly —
 * those are hosted concerns and the boundary test fails the import once they
 * move under src/hosted/.
 *
 * Spec: docs/superpowers/specs/2026-09-02-oss-single-tenant-export-design.md
 */
import type { Payload } from 'payload'
import { resolveById, resolveForHost, resolveOf } from './entitlements-overlay'

export interface Entitlements {
  /** Product cap; `Infinity` when unlimited. */
  maxProducts: number
  /** Media storage cap in bytes; `Infinity` when unlimited. */
  maxStorageBytes: number
  premiumSections: boolean
  mcpWrites: boolean
  voiceAssistant: boolean
  customCss: boolean
  customSections: boolean
  customDomains: boolean
  giftCards: boolean
  /** Human label for the tier ("Free", "Growth"; "Self-hosted" in OSS). */
  label: string
  /** Whether an upgrade path exists — drives "Upgrade to Growth" copy. */
  canUpgrade: boolean
}

/** Usage counters the hosted product tracks against the caps. */
export interface StoreUsage {
  mediaBytesUsed: number
}

/** A store that may do everything: the OSS build. */
export const EVERYTHING: Readonly<Entitlements> = Object.freeze({
  maxProducts: Number.POSITIVE_INFINITY,
  maxStorageBytes: Number.POSITIVE_INFINITY,
  premiumSections: true,
  mcpWrites: true,
  voiceAssistant: true,
  customCss: true,
  customSections: true,
  customDomains: true,
  giftCards: true,
  label: 'Self-hosted',
  canUpgrade: false,
})

/** The minimum a store doc must carry for `entitlementsOf`. `plan` only exists hosted. */
export interface EntitledStore {
  plan?: string | null
}

/** Entitlements from a store document already in hand (storefront pages, admin nav). */
export function entitlementsOf(store: EntitledStore): Promise<Entitlements> {
  return resolveOf(store)
}

/** Entitlements plus usage for a store id (collection hooks, import routes, admin meters). */
export function entitlementsById(
  payload: Payload,
  storeId: string | number,
): Promise<Entitlements & { usage: StoreUsage }> {
  return resolveById(payload, storeId)
}

/**
 * Entitlements for the store the request Host names, or null when the host
 * resolves to no store (the platform apex, an unknown domain). Callers must
 * treat null as "no entitlements" — never as everything.
 */
export function entitlementsForHost(payload: Payload, host: string | null): Promise<Entitlements | null> {
  return resolveForHost(payload, host)
}
