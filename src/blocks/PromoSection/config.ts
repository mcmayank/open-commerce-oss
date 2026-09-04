import type { Block } from 'payload'

/**
 * Promo Section — a merchandising promo band (sale / launch / seasonal) with an
 * image, copy, and up to two CTAs. Richer than CTABanner (which is text-only).
 * Presentational; self-styles per variant using per-tenant theme vars.
 */
export const PromoSection: Block = {
  slug: 'promoSection',
  interfaceName: 'PromoSectionBlock',
  labels: { singular: 'Promo Section', plural: 'Promo Sections' },
  fields: [
    {
      name: 'variant', type: 'select', required: true, defaultValue: 'splitImage',
      options: [
        { label: 'Split image', value: 'splitImage' },
        { label: 'Full-bleed overlay', value: 'overlay' },
        { label: 'Compact banner', value: 'bannerStrip' },
      ],
      admin: { components: { Field: '@/components/admin/VariantPickerField' } },
    },
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'media', type: 'upload', relationTo: 'media', admin: { description: 'Used by Split image and Full-bleed overlay.' } },
    { name: 'primaryCtaLabel', type: 'text' },
    { name: 'primaryCtaHref', type: 'text', admin: { description: 'e.g. /products' } },
    { name: 'secondaryCtaLabel', type: 'text' },
    { name: 'secondaryCtaHref', type: 'text' },
  ],
}
