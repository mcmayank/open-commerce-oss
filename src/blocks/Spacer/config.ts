import type { Block } from 'payload'

export const Spacer: Block = {
  slug: 'spacer',
  interfaceName: 'SpacerBlock',
  labels: { singular: 'Spacer / Divider', plural: 'Spacers / Dividers' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'blank',
      options: [
        { label: 'Blank space', value: 'blank' },
        { label: 'Line', value: 'line' },
        { label: 'Dots', value: 'dots' },
        { label: 'Gradient', value: 'gradient' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    {
      name: 'size',
      type: 'select',
      required: true,
      defaultValue: 'md',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
        { label: 'Extra large', value: 'xl' },
      ],
    },
  ],
}
