import type { Block } from 'payload'

export const Steps: Block = {
  slug: 'steps',
  interfaceName: 'StepsBlock',
  labels: { singular: 'Steps', plural: 'Steps' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'horizontal',
      options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical timeline', value: 'vertical' },
        { label: 'Cards', value: 'cards' },
        { label: 'Compact list', value: 'compact' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    { name: 'numbered', type: 'checkbox', defaultValue: true },
    {
      name: 'steps', type: 'array', minRows: 1,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
  ],
}
