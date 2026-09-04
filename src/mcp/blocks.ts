import type { Block, Field } from 'payload'
import { PREMIUM_BLOCK_TYPES } from '@/blocks/premium'

export type BlockFieldSummary = { name: string; type: string; required: boolean }
export type BlockSummary = { slug: string; premium: boolean; fields: BlockFieldSummary[] }

/** Named, persisted fields only — skips presentational fields (rows/collapsibles) that carry no `name`. */
const isNamedField = (f: Field): f is Field & { name: string; type: string } =>
  'name' in f && typeof (f as { name?: unknown }).name === 'string'

/**
 * Describe the storefront page blocks for the `list_blocks` MCP tool so an AI client can compose a
 * page `layout` without hardcoding block shapes. Top-level shape only — nested subfields (array/group
 * children) are intentionally omitted to keep the summary compact; the client learns them by example.
 */
export function summarizeBlocks(blocks: Block[]): BlockSummary[] {
  return blocks.map((block) => ({
    slug: block.slug,
    premium: PREMIUM_BLOCK_TYPES.has(block.slug),
    fields: (block.fields ?? []).filter(isNamedField).map((f) => ({
      name: f.name,
      type: f.type,
      required: Boolean((f as { required?: boolean }).required),
    })),
  }))
}

/** The plan entitlements that decide whether a block can actually be saved. */
export type BlockEntitlements = { premiumSections: boolean; customSections: boolean }

/**
 * Blocks gated on an entitlement OTHER than `premiumSections`, keyed by slug.
 *
 * `customSection` is deliberately absent from `PREMIUM_BLOCK_TYPES` — that set is
 * checked at render, and a downgrade must never strip sections off a live
 * storefront — so its gate lives at the write boundary instead
 * (`assertCustomSections` in src/lib/plan-enforcement.ts). Reading availability
 * from `premium` alone therefore reported it usable by every store: an AI client
 * would compose a layout with it and the save would come back 403, which is the
 * exact failure the `available` flag exists to prevent.
 */
const ENTITLEMENT_GATED_BLOCKS: Record<string, keyof BlockEntitlements> = {
  customSection: 'customSections',
}

/**
 * Whether the connected store can actually save a layout containing this block.
 *
 * Availability must mirror what enforcement will do at write time, not what the
 * renderer will do — a block the client is offered and then refused is worse than
 * one it was never offered.
 */
export function blockAvailable(block: BlockSummary, entitlements: BlockEntitlements): boolean {
  if (block.premium && !entitlements.premiumSections) return false
  const required = ENTITLEMENT_GATED_BLOCKS[block.slug]
  if (required && !entitlements[required]) return false
  return true
}
