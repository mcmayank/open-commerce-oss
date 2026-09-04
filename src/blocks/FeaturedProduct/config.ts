import type { Block } from 'payload'

export const FeaturedProduct: Block = {
  slug: 'featuredProduct',
  interfaceName: 'FeaturedProductBlock',
  labels: { singular: 'Featured Product', plural: 'Featured Products' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'imageLeft',
      options: [
        { label: 'Image left', value: 'imageLeft' },
        { label: 'Image right', value: 'imageRight' },
        { label: 'Overlay', value: 'overlay' },
        { label: 'Stacked', value: 'stacked' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'product', type: 'relationship', relationTo: 'products', required: true },
    { name: 'headingOverride', type: 'text' },
    { name: 'ctaLabel', type: 'text', defaultValue: 'View' },
  ],
}
