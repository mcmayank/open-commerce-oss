import type { Block } from 'payload'

/**
 * Ticker — a compact strip of short phrases separated by a divider
 * ("Stone-milled flour · 24-hour ferment · Baked fresh daily"). Two variants:
 * a centered static row, or a seamless auto-scrolling marquee. Presentational.
 */
export const Ticker: Block = {
  slug: 'ticker',
  interfaceName: 'TickerBlock',
  labels: { singular: 'Ticker', plural: 'Tickers' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'static',
      options: [
        { label: 'Static row', value: 'static' },
        { label: 'Marquee', value: 'marquee' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    {
      name: 'separator', type: 'text', defaultValue: '·',
      admin: { description: 'Character shown between phrases (e.g. · or —).' },
    },
    {
      name: 'items', type: 'array', minRows: 1, maxRows: 12,
      labels: { singular: 'Phrase', plural: 'Phrases' },
      fields: [{ name: 'label', type: 'text', required: true }],
    },
  ],
}
