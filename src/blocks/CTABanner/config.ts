import type { Block } from 'payload'

export const CTABanner: Block = {
  slug: 'ctaBanner',
  interfaceName: 'CTABannerBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'buttonLabel', type: 'text' },
    {
      name: 'buttonHref',
      type: 'text',
      admin: { description: 'e.g. /products or https://example.com' },
    },
  ],
}
