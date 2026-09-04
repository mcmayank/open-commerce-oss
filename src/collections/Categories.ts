import type { CollectionConfig } from 'payload'
import { perTenantSlugField } from '@/fields/perTenantSlug'
import { revalidateTenantHook } from '@/lib/storefront-cache'
import { NAV_GROUPS } from './nav-groups'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { group: NAV_GROUPS.categories, useAsTitle: 'title' },
  // Per-store uniqueness. The hosted overlay prefixes `tenant` at compose time
  // (TENANT_INDEXES in src/hosted/config.ts), which keeps the generated index name.
  indexes: [{ fields: ['slug'], unique: true }],
  hooks: {
    afterChange: [revalidateTenantHook('categories').afterChange],
    afterDelete: [revalidateTenantHook('categories').afterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    perTenantSlugField('categories'),
    { name: 'description', type: 'textarea' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional. Used by the Category Previews storefront block.' },
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
  ],
}
