import type { Block } from 'payload'

/**
 * SplitHero (legacy) — superseded by the unified Hero block (src/blocks/Hero/config.ts) per 2026-08-17 unified-hero plan.
 * Kept registered only so existing rows render; editors should use Hero for new content.
 */
export const SplitHero: Block = {
  slug: 'splitHero',
  interfaceName: 'SplitHeroBlock',
  labels: { singular: 'Split Hero (legacy — use Hero)', plural: 'Split Heroes (legacy)' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'mediaLeft',
      options: [
        { label: 'Media left', value: 'mediaLeft' },
        { label: 'Media right', value: 'mediaRight' },
        { label: 'Full-bleed overlay', value: 'overlay' },
        { label: 'Stacked', value: 'stacked' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    {
      // Only meaningful for the centered layouts; hidden for media-left/right,
      // whose text sits in its own column.
      name: 'textAlign',
      type: 'radio',
      defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      admin: {
        layout: 'horizontal',
        description: 'How the text and buttons are aligned.',
        condition: (_data, sibling) => sibling?.variant === 'overlay' || sibling?.variant === 'stacked',
      },
    },
    {
      // Full-bleed overlay only: where the text sits over the image vertically.
      name: 'overlayVerticalAlign',
      type: 'radio',
      defaultValue: 'middle',
      options: [
        { label: 'Top', value: 'top' },
        { label: 'Middle', value: 'middle' },
        { label: 'Bottom', value: 'bottom' },
      ],
      admin: {
        layout: 'horizontal',
        description: 'Vertical position of the text over the image.',
        condition: (_data, sibling) => sibling?.variant === 'overlay',
      },
    },
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    { name: 'media', type: 'upload', relationTo: 'media' },
    { name: 'primaryCtaLabel', type: 'text' },
    { name: 'primaryCtaHref', type: 'text', admin: { description: 'e.g. /products' } },
    { name: 'secondaryCtaLabel', type: 'text' },
    { name: 'secondaryCtaHref', type: 'text' },
  ],
}
