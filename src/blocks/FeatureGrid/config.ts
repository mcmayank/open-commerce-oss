import type { Block } from 'payload'
import { FEATURE_ICON_OPTIONS } from './icons'

export const FeatureGrid: Block = {
  slug: 'featureGrid',
  interfaceName: 'FeatureGridBlock',
  labels: { singular: 'Feature Grid', plural: 'Feature Grids' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'iconTop',
      options: [
        { label: 'Icon on top', value: 'iconTop' },
        { label: 'Icon on left', value: 'iconLeft' },
        { label: 'Cards', value: 'cards' },
        { label: 'Minimal', value: 'minimal' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'heading', type: 'text' },
    {
      name: 'columns', type: 'select', required: true, defaultValue: '3',
      options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }],
    },
    {
      name: 'items', type: 'array', minRows: 1,
      fields: [
        { name: 'icon', type: 'select', required: true, defaultValue: 'star', options: FEATURE_ICON_OPTIONS },
        { name: 'heading', type: 'text', required: true },
        { name: 'text', type: 'textarea' },
      ],
    },
  ],
}
