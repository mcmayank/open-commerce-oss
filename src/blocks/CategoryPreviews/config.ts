import type { Block } from 'payload'

/**
 * Category Previews — showcase store categories with imagery, each linking to
 * the filtered product list (/products?category=<slug>). Data-bound: pulls the
 * tenant's real categories (mirrors ProductGrid's source pattern).
 */
export const CategoryPreviews: Block = {
  slug: 'categoryPreviews',
  interfaceName: 'CategoryPreviewsBlock',
  labels: { singular: 'Category Previews', plural: 'Category Previews' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'grid',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Overlay cards', value: 'overlayCards' },
        { label: 'List', value: 'list' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    {
      name: 'source', type: 'select', required: true, defaultValue: 'all',
      options: [
        { label: 'All categories', value: 'all' },
        { label: 'Manual selection', value: 'manual' },
      ],
    },
    {
      name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true,
      admin: {
        condition: (_data, sibling) => sibling?.source === 'manual',
        description: 'Choose and order the categories to display.',
      },
    },
    {
      name: 'limit', type: 'number', defaultValue: 6, min: 1, max: 24,
      admin: { description: 'Max categories to show (ignored for manual selection).' },
    },
  ],
}
