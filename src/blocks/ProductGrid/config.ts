import type { Block } from 'payload'

export const ProductGrid: Block = {
  slug: 'productGrid',
  interfaceName: 'ProductGridBlock',
  fields: [
    {
      // Optional (not required): existing productGrid blocks predate this field,
      // so the component defaults to 'grid' when unset.
      name: 'variant', type: 'select', defaultValue: 'grid',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Carousel', value: 'carousel' },
        { label: 'List', value: 'list' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    {
      name: 'columns', type: 'select', defaultValue: '4',
      options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }],
      admin: { description: 'Columns for the Grid variant.' },
    },
    { name: 'eyebrow', type: 'text', admin: { description: 'Small kicker above the heading, e.g. "At the bench today".' } },
    { name: 'heading', type: 'text' },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'latest',
      options: [
        { label: 'Latest products', value: 'latest' },
        { label: 'By category', value: 'category' },
        { label: 'Manual selection', value: 'manual' },
      ],
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        condition: (_data, siblingData) => siblingData?.source === 'category',
        description: 'Show products from this category',
      },
    },
    {
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        condition: (_data, siblingData) => siblingData?.source === 'manual',
        description: 'Manually choose products to display',
      },
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 8,
      min: 1,
      max: 48,
      admin: { description: 'Max products to show (ignored for manual selection)' },
    },
  ],
}
