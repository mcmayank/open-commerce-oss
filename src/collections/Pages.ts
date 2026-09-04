import type { CollectionConfig } from 'payload'
import { isEnforced, assertPremiumSections, assertCustomSections } from '@/lib/plan-enforcement'
import { seedCustomSectionSchemes } from '@/lib/seed-custom-section-scheme'
import type { LayoutBlock } from '@/blocks/premium-diff'
import { perTenantSlugField } from '@/fields/perTenantSlug'
import { PAGE_BLOCKS } from '@/blocks/registry'
import { revalidateTenantHook } from '@/lib/storefront-cache'
import { NAV_GROUPS } from './nav-groups'
import { storeIdOf } from '@/store-scope'

/**
 * Slugs a page may NOT use: each collides with a fixed storefront route, so a
 * page with one of these slugs would be shadowed and unreachable (pages render
 * at `/<slug>`). Keep in sync with the top-level segments under
 * `src/app/(storefront)/store/[tenant]/` (plus `admin`/`api`).
 */
const RESERVED_PAGE_SLUGS = ['products', 'cart', 'checkout', 'account', 'unsubscribe', 'pages', 'admin', 'api']

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: NAV_GROUPS.pages,
    useAsTitle: 'title',
    components: {
      views: {
        edit: {
          // Not the builder itself — the builder is a full-bleed ROOT view at
          // `/admin/pages/:id/builder` (registered in payload.config.ts). This
          // stub is what the Pages list still links rows to, so it forwards
          // there, and keeps Payload's stock form reachable at `?form=1` for
          // any field the builder cannot express.
          default: {
            Component: '@/components/admin/page-builder/EditRedirect',
          },
        },
      },
    },
    preview: (doc) => {
      const slug = (doc as { slug?: string })?.slug
      if (!slug) return null
      const secret = process.env.PREVIEW_SECRET ?? ''
      return `/api/preview?secret=${encodeURIComponent(secret)}&slug=${encodeURIComponent(slug)}`
    },
  },
  versions: { drafts: true, maxPerDoc: 20 },
  hooks: {
    beforeChange: [
      // AI writes drafts, humans publish: any page create/update coming through the MCP server
      // (req.payloadAPI === 'MCP', set by @payloadcms/plugin-mcp) is forced to draft status. The
      // store owner reviews in the existing preview UI and publishes deliberately.
      ({ req, data }) => (req.payloadAPI === 'MCP' ? { ...data, _status: 'draft' } : data),
      async ({ req, data, originalDoc }) => {
        if (!isEnforced(req)) return data
        const tenantId = storeIdOf(data as { tenant?: unknown }) ??
          storeIdOf(originalDoc as { tenant?: unknown } | undefined)
        if (tenantId === undefined) return data
        await assertPremiumSections(
          req.payload,
          tenantId,
          (data as { layout?: LayoutBlock[] }).layout,
          (originalDoc as { layout?: LayoutBlock[] } | undefined)?.layout ?? null,
        )
        await assertCustomSections(
          req.payload,
          tenantId,
          (data as { layout?: LayoutBlock[] }).layout,
          (originalDoc as { layout?: LayoutBlock[] } | undefined)?.layout ?? null,
        )
        return data
      },
      // Seeding is not an entitlement check and must run even where isEnforced()
      // is false (single-tenant self-host, super-admin, seed scripts) — otherwise
      // a self-hosted store's custom sections would all render on the default band.
      async ({ req, data, originalDoc }) => {
        await seedCustomSectionSchemes(
          req.payload,
          (data as { layout?: unknown }).layout,
          (originalDoc as { layout?: unknown } | undefined)?.layout ?? null,
        )
        return data
      },
    ],
    afterChange: [revalidateTenantHook('pages').afterChange],
    afterDelete: [revalidateTenantHook('pages').afterDelete],
  },
  fields: [
    // Unnamed tabs (label, no name) are purely presentational — title/slug/layout
    // keep their existing top-level paths, so there is no schema change or data
    // migration for them; only the new SEO fields add columns. Mirrors StoreSettings.
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', required: true },
            perTenantSlugField('pages', { reserved: RESERVED_PAGE_SLUGS }),
            {
              name: 'layout',
              type: 'blocks',
              minRows: 0,
              blocks: PAGE_BLOCKS,
            },
          ],
        },
        {
          label: 'SEO',
          description: 'Search engine & AI answer-engine settings for this page. All fields are optional — blanks fall back to sensible defaults.',
          fields: [
            {
              name: 'meta',
              type: 'group',
              label: 'Search (SEO)',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  admin: {
                    description: 'Overrides the browser tab and search-result title. Leave blank to use the page title. ~60 characters.',
                  },
                },
                {
                  name: 'description',
                  type: 'textarea',
                  admin: {
                    description: 'Meta description shown in search results and social shares. ~155 characters.',
                  },
                },
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description: 'Social share image (Open Graph / Twitter). Recommended 1200×630.',
                  },
                },
                {
                  name: 'canonicalUrl',
                  type: 'text',
                  admin: {
                    description: 'Canonical URL override for duplicate-content control. Leave blank to use this page’s own URL.',
                  },
                },
              ],
            },
            {
              name: 'noindex',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Hide this page from search engines and AI crawlers (robots: noindex, nofollow).',
              },
            },
            {
              name: 'aeo',
              type: 'group',
              label: 'Answer engines (AEO)',
              admin: {
                description: 'Help AI answer engines (ChatGPT, Perplexity, Google AI Overviews) understand and quote this page.',
              },
              fields: [
                {
                  name: 'answerSummary',
                  type: 'textarea',
                  admin: {
                    description: 'A direct 1–2 sentence answer/summary AI engines can quote. Feeds the page’s structured-data description.',
                  },
                },
                {
                  name: 'schemaType',
                  type: 'select',
                  defaultValue: 'WebPage',
                  admin: {
                    description: 'Primary schema.org type emitted as JSON-LD. FAQ blocks additionally emit FAQPage automatically.',
                  },
                  options: [
                    { label: 'Web page', value: 'WebPage' },
                    { label: 'Article', value: 'Article' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'isSampleContent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        hidden: true,
        description: 'Created by the sample catalogue seeder.',
      },
    },
    {
      // Per-instance block style overrides, keyed by the block's own `id` (the React
      // key in src/blocks/index.tsx), e.g. { "<blockId>": { heading: { size: 'xl' } } }.
      // The per-instance layer of the three-layer resolveBlockStyle merge (theme
      // default → store-wide blockStyleDefaults → this). Hidden: the Task 6 Style
      // panel edits this per block, not as a raw JSON blob on the page form.
      name: 'blockStyles',
      type: 'json',
      admin: { hidden: true },
    },
  ],
}
