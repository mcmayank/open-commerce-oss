import type { Block } from 'payload'

/**
 * StoryStats — an editorial "our story" split: a photo alongside an eyebrow,
 * serif heading, body copy, and a row of stat counters (value + label, e.g.
 * "24h / Slow ferment"). Presentational; consumes per-tenant theme tokens.
 */
export const StoryStats: Block = {
  slug: 'storyStats',
  interfaceName: 'StoryStatsBlock',
  labels: { singular: 'Story + Stats', plural: 'Story + Stats' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'imageRight',
      options: [
        { label: 'Image left', value: 'imageLeft' },
        { label: 'Image right', value: 'imageRight' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'stats', type: 'array', maxRows: 4,
      labels: { singular: 'Stat', plural: 'Stats' },
      fields: [
        { name: 'value', type: 'text', required: true, admin: { description: 'e.g. 24h, 4, 0' } },
        { name: 'label', type: 'text', required: true, admin: { description: 'e.g. Slow ferment' } },
      ],
    },
  ],
}
