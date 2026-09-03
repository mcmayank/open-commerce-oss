import type { Block } from 'payload'

export const Contact: Block = {
  slug: 'contact',
  interfaceName: 'ContactBlock',
  labels: { singular: 'Contact / Location', plural: 'Contact Blocks' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'mapSplit',
      options: [
        { label: 'Map + details (split)', value: 'mapSplit' },
        { label: 'Details, map below', value: 'mapStacked' },
        { label: 'Details only', value: 'detailsOnly' },
        { label: 'Compact banner', value: 'banner' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    { name: 'address', type: 'textarea' },
    {
      name: 'hours', type: 'array', fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
    { name: 'phone', type: 'text' },
    { name: 'whatsapp', type: 'text', admin: { description: 'Number in international format, e.g. 971500000000' } },
    { name: 'email', type: 'text' },
    {
      name: 'mapEmbedUrl',
      type: 'text',
      admin: {
        description:
          'Google Maps > Share > Embed a map > copy the src URL. Only a Google Maps embed URL renders here — anything else, or an invalid URL, shows as a blank frame.',
      },
    },
  ],
}
