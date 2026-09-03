import type { CollectionConfig } from 'payload'
import { perTenantSlugField } from '@/fields/perTenantSlug'
import { isEnforced, assertProductQuota, assertGiftCardSale } from '@/lib/plan-enforcement'
import { revalidateTenantHook } from '@/lib/storefront-cache'
import { deriveVariantTitle, type ProductOption } from '@/lib/variants'
import { safeSlugify } from '@/lib/slug'
import { NAV_GROUPS } from './nav-groups'
import { storeIdOf } from '@/store-scope'

const priceField = (name: string) => ({
  name,
  type: 'number' as const,
  required: true,
  min: 0,
  admin: {
    description: 'Price customers pay. Stored in minor units; enter a normal amount above.',
    components: { Field: '@/components/admin/MoneyField' },
  },
  validate: (value: unknown) =>
    value == null || Number.isInteger(value)
      ? true
      : 'Price must be a whole number of minor units (e.g. 1000 = ₹10.00).',
})

export const Products: CollectionConfig = {
  slug: 'products',
  admin: { group: NAV_GROUPS.products, useAsTitle: 'title', defaultColumns: ['title', 'status', 'price', 'stock'] },
  // Per-store uniqueness; hosted prefixes `tenant` (TENANT_INDEXES in src/hosted/config.ts).
  indexes: [{ fields: ['slug'], unique: true }],
  hooks: {
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        // Gate the TRANSITION, not the steady state. A product that already issues gift
        // cards keeps working through a downgrade, the same way an existing custom
        // domain keeps resolving — see assertCustomDomain. Only switching the flag on
        // requires the entitlement.
        const turningOn = data?.issuesGiftCard === true && originalDoc?.issuesGiftCard !== true
        if (turningOn && isEnforced(req)) {
          await assertGiftCardSale(req.payload, storeIdOf(data as { tenant?: unknown }))
        }

        if (operation !== 'create' || !isEnforced(req)) return data
        const tenantId = storeIdOf(data as { tenant?: unknown })
        if (tenantId === undefined) return data
        await assertProductQuota(req.payload, tenantId)
        return data
      },
    ],
    afterChange: [revalidateTenantHook('products').afterChange],
    afterDelete: [revalidateTenantHook('products').afterDelete],
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        // Fill an empty slug from the title. Runs before field validation, so a
        // merchant never has to satisfy `required` on a field they shouldn't
        // need to think about. Deriving on the SERVER is deliberate: Payload
        // remounts field components on every write, so a client component
        // cannot reliably remember whether the merchant has taken the field
        // over — see the note in `components/admin/SlugField.tsx`.
        //
        // Only ever fills a blank. A slug that exists is a live storefront URL
        // (/store/<tenant>/products/<slug>) and is never rewritten from here.
        if (!data.slug && typeof data.title === 'string') {
          const derived = safeSlugify(data.title)
          if (derived) data.slug = derived
        }

        const options = (data.options ?? []) as ProductOption[]
        if (options.length > 0 && Array.isArray(data.variants)) {
          data.variants = data.variants.map((v: Record<string, unknown>) => {
            const optionValues = (v.optionValues ?? null) as
              | { option: string; value: string }[]
              | null
            const derived = deriveVariantTitle(optionValues, options)
            return derived ? { ...v, title: derived } : v
          })
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'quotaNotice',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/ProductQuotaNotice' } },
    },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'richText' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'category', type: 'relationship', relationTo: 'categories' },
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
      name: 'issuesGiftCard',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'When on, paying for this product issues a gift card per unit. Each variant price is the card’s face value. Gift-card products are never taxed — the tax is charged when the card is spent.',
      },
    },

    // Sidebar: the two things you set rather than compose.
    perTenantSlugField('products', { autoDerive: true, position: 'sidebar' }),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      admin: { position: 'sidebar' },
      // Stored values unchanged — labels are display only.
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
      ],
    },

    {
      type: 'collapsible',
      label: 'Pricing & stock',
      fields: [
        priceField('price'),
        {
          name: 'stock',
          type: 'number',
          /**
           * Schema DELIBERATELY unchanged for gift cards. Nothing reads this
           * column for a gift-card product any more — every consumer goes
           * through `tracksInventory` / `isInStock` in `src/lib/inventory.ts` —
           * so the stored 0 is inert, not wrong.
           *
           * And do NOT reach for `admin.condition` to hide it on gift cards,
           * however tempting: Payload treats a conditional field as NULLABLE in
           * the generated schema, so the condition alone produces
           * `ALTER COLUMN "stock" DROP NOT NULL` on both `products` and
           * `products_variants`. That is a real migration on a live table, and
           * it drops the constraint for EVERY product to spare gift-card
           * merchants one ignored input. Worse, `isInStock` reads a null as out
           * of stock, so it opens a way for an ordinary product to go silently
           * unbuyable. The wording below carries the same information at no
           * schema cost. CI caught this; see the drift check in the workflow.
           */
          required: true,
          defaultValue: 0,
          min: 0,
          admin: {
            description:
              'How many you have. 0 shows this product as “Out of stock” on your storefront. Ignored for gift cards — they are generated on demand and never run out.',
          },
        },
      ],
    },

    // `collapsible` is presentational and owns no data path, so `options` and
    // `variants` keep their top-level names — which VariantOptionValues reads
    // directly via fields['options']. Never make this a `group`.
    {
      type: 'collapsible',
      label: 'Variants & options',
      admin: {
        initCollapsed: true,
        description:
          'Sizes, colours and the like — e.g. Small / Medium / Large. Define the options first, then a variant for each combination you sell. Leave closed if this product is sold as a single item.',
      },
      fields: [
        {
          name: 'options',
          type: 'array',
          admin: { description: 'Variant axes, e.g. Size with values S/M/L.' },
          fields: [
            { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Size"' } },
            {
              name: 'values',
              type: 'array',
              required: true,
              fields: [{ name: 'value', type: 'text', required: true }],
            },
          ],
        },
        {
          name: 'variants',
          type: 'array',
          admin: { description: 'Each variant has its own price, stock and SKU.' },
          fields: [
            {
              name: 'title',
              type: 'text',
              admin: {
                description:
                  'Auto-filled from the selected options when this product defines options; otherwise enter a label like "M / Red".',
              },
            },
            {
              name: 'optionValues',
              type: 'array',
              admin: {
                description: 'Which option value this variant is, per axis.',
                components: { Field: '@/components/admin/VariantOptionValues' },
              },
              fields: [
                { name: 'option', type: 'text', required: true },
                { name: 'value', type: 'text', required: true },
              ],
            },
            priceField('price'),
            { name: 'sku', type: 'text' },
            {
              // Same schema, same reason as the product-level `stock` above,
              // including the note about `admin.condition`: a denomination
              // (50 / 100 / 200) has no more inventory than the card itself,
              // but hiding this field conditionally would drop NOT NULL on
              // `products_variants.stock` for every variant in the platform.
              // Availability is decided by `isInStock`, never by this number.
              name: 'stock',
              type: 'number',
              required: true,
              defaultValue: 0,
              min: 0,
            },
          ],
        },
      ],
    },

    {
      type: 'collapsible',
      label: 'Specifications',
      admin: {
        initCollapsed: true,
        description:
          'Structured product details rendered as a spec table and schema.org properties.',
      },
      fields: [
        {
          name: 'specifications',
          type: 'array',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              admin: { description: 'e.g. "Material"' },
            },
            {
              name: 'value',
              type: 'text',
              required: true,
              admin: { description: 'e.g. "Organic cotton"' },
            },
          ],
        },
      ],
    },
    {
      /**
       * Provenance for an imported product, and the key re-import rides on.
       *
       * A second run of the same import finds the product by
       * (tenant, importedFrom.externalId) and UPDATES it, so re-running is safe
       * rather than duplicating a catalog. Nothing else keys off this.
       */
      name: 'importedFrom',
      type: 'group',
      admin: {
        readOnly: true,
        description: 'Set by the product importer. Absent on products created by hand.',
      },
      fields: [
        { name: 'sourceId', type: 'text' },
        { name: 'sourceOrigin', type: 'text' },
        { name: 'externalId', type: 'text', index: true },
        { name: 'importedAt', type: 'date' },
        {
          /**
           * What the SOURCE store meant by its prices, captured at import time.
           * Storefront tax is not calculated yet (`src/lib/tax.ts` returns
           * zero), so this is the record that lets an imported catalog be
           * reconciled when it is — without it, "was 100 inclusive or
           * exclusive?" is unanswerable after the fact.
           */
          name: 'priceTaxTreatment',
          type: 'select',
          options: ['inclusive', 'exclusive'],
        },
      ],
    },
  ],
}
