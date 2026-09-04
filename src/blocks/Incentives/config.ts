import type { Block } from 'payload'
import { INCENTIVE_ICON_OPTIONS } from './icons'

/**
 * Incentives — a compact trust-badge strip (free shipping / easy returns /
 * secure payment / support). Presentational; all content is editor-authored.
 * Distinct from FeatureGrid: an inline icon+label row meant to reassure buyers,
 * not a feature showcase.
 */
export const Incentives: Block = {
  slug: 'incentives',
  interfaceName: 'IncentivesBlock',
  labels: { singular: 'Incentives', plural: 'Incentives' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'columns', type: 'select', required: true, defaultValue: '4',
      options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }],
    },
    {
      name: 'items', type: 'array', minRows: 1, maxRows: 8,
      labels: { singular: 'Incentive', plural: 'Incentives' },
      fields: [
        { name: 'icon', type: 'select', required: true, defaultValue: 'truck', options: INCENTIVE_ICON_OPTIONS },
        { name: 'heading', type: 'text', required: true },
        { name: 'text', type: 'textarea' },
      ],
    },
  ],
}
