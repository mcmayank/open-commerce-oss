import type { Block } from 'payload'

export const LogoStrip: Block = {
  slug: 'logoStrip',
  interfaceName: 'LogoStripBlock',
  labels: { singular: 'Logo Strip', plural: 'Logo Strips' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'staticRow',
      options: [
        { label: 'Static row', value: 'staticRow' },
        { label: 'Grid', value: 'grid' },
        { label: 'Marquee', value: 'marquee' },
        { label: 'Bordered', value: 'bordered' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    { name: 'grayscale', type: 'checkbox', defaultValue: true },
    {
      name: 'logos',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text' },
      ],
    },
  ],
}
