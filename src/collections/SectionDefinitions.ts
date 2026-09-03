import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isEnforced, assertCustomSectionDefinition } from '@/lib/plan-enforcement'
import { countPagesUsingDefinition } from '@/lib/section-definition-usage'
import { parseRecipe, RecipeError } from '@/blocks/recipe/parse'
import { revalidateTenantHook } from '@/lib/storefront-cache'
import { NAV_GROUPS } from './nav-groups'
import { storeIdOf } from '@/store-scope'

/**
 * A merchant's reusable section layouts. Each row is one recipe — a description of
 * an arrangement built from Niblr's own content types, not new behaviour and not a
 * new block type. One `customSection` block places any of them, which is what keeps
 * this to a single migration however many sections a merchant defines.
 *
 * Drafts are on so editing a definition does not silently redesign every page using
 * it: the edit sits unpublished until the merchant publishes, and the storefront
 * keeps serving the published version.
 */
export const SectionDefinitions: CollectionConfig = {
  slug: 'section-definitions',
  labels: { singular: 'Section', plural: 'Sections' },
  admin: {
    group: NAV_GROUPS['section-definitions'],
    useAsTitle: 'name',
    description: 'Reusable section layouts. Pick a starting layout and fill in your own content.',
  },
  versions: { drafts: true, maxPerDoc: 20 },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'What you will see when picking this section on a page.' },
    },
    {
      name: 'recipe',
      type: 'json',
      required: true,
      label: 'Layout',
      admin: {
        description: 'Pick a starting layout. You can change it before you publish.',
        components: { Field: '@/components/admin/SectionPresetField' },
      },
      // Rejecting at the write boundary is the same posture as src/lib/custom-css.ts:
      // a row that reaches the database is one the parser already accepted. The read
      // path re-parses anyway, because a row can still arrive by other means. The
      // picker component is a convenience layered on top, not a replacement for this.
      validate: (value: unknown) => {
        try {
          parseRecipe(value)
          return true
        } catch (err) {
          return err instanceof RecipeError ? err.message : 'This section layout is not valid.'
        }
      },
    },
    {
      name: 'presetId',
      type: 'text',
      admin: { readOnly: true, description: 'Which starting layout this section came from.' },
    },
  ],
  hooks: {
    // A definition is populated INTO the page cache: getPageBySlug reads pages at
    // depth 2 under the tenant's `pages` tag with a 3600s TTL, so the rendered
    // section is whatever definition the page cache captured. Without this, a
    // merchant publishes a definition and the storefront shows nothing for up to
    // an hour, and republishing an edited recipe keeps serving the old design.
    // Same reasoning as revalidateMediaHook in src/lib/storefront-cache.ts, which
    // exists because Media is populated into page caches too.
    afterChange: [revalidateTenantHook('pages').afterChange],
    afterDelete: [revalidateTenantHook('pages').afterDelete],
    beforeChange: [
      async ({ req, data, operation, originalDoc }) => {
        if (operation !== 'create') return data
        if (!isEnforced(req)) return data
        const tenantId =
          storeIdOf(data as { tenant?: unknown }) ??
          storeIdOf(originalDoc as { tenant?: unknown } | undefined)
        if (tenantId === undefined) return data
        await assertCustomSectionDefinition(req.payload, tenantId)
        return data
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const count = await countPagesUsingDefinition(req.payload, id)
        if (count === 0) return
        throw new APIError(
          `This section is used on ${count} page${count === 1 ? '' : 's'}. ` +
            `Remove it from ${count === 1 ? 'that page' : 'those pages'} first.`,
          409,
        )
      },
    ],
  },
}
