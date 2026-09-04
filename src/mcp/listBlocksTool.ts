import type { PayloadRequest } from 'payload'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { summarizeBlocks, blockAvailable, type BlockEntitlements } from './blocks'
import { entitlementsForHost } from '@/entitlements'

/**
 * `list_blocks` MCP tool — lets an AI client discover the storefront page-builder blocks (name,
 * fields, and whether the connected store's plan can use each) before composing a page `layout`
 * via create_page/update_page. Tenant is resolved from the request Host (same mechanism as the
 * admin), so availability reflects the store the key is connected to.
 */
export const listBlocksTool = () => ({
  name: 'list_blocks',
  description:
    'List the storefront page-builder blocks available for composing a page layout. Returns each ' +
    "block's slug, fields (name/type/required), whether it is a premium block, and whether this " +
    'store\'s plan can use it (`available`). Call this before creating or updating a page.',
  parameters: {} as Record<string, never>,
  handler: async (_args: Record<string, unknown>, req: PayloadRequest) => {
    // Default-closed: an unresolved host gets neither entitlement, so the client is
    // never told a gated block is usable by a store we could not identify.
    const ent = await entitlementsForHost(req.payload, req.headers.get('host'))
    const entitlements: BlockEntitlements = ent
      ? { premiumSections: ent.premiumSections, customSections: ent.customSections }
      : { premiumSections: false, customSections: false }
    const blocks = summarizeBlocks(PAGE_BLOCKS).map((b) => ({
      ...b,
      available: blockAvailable(b, entitlements),
    }))
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ blocks }, null, 2) }],
    }
  },
})
