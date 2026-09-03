import type { ThemeMeta } from '../types'

/**
 * Pure metadata + design preset for the SD Bakery theme. Free of component /
 * font imports so it (via catalog.ts) can be imported from the Payload server
 * config and client field UIs without dragging in the RSC bundle.
 *
 * SD Bakery is a token/layout preset over the shared storefront (Slice E): a
 * warm cream-and-olive palette with an editorial serif masthead (Cormorant
 * Garamond) over a Jost sans body, sharp (0-radius) corners, and a centered
 * header. Fonts are loaded globally in the (storefront) layout.
 */
export const sdBakeryMeta: ThemeMeta = {
  slug: 'sd-bakery',
  label: 'SD Bakery',
  entitlement: 'premium',
  description: 'A warm, artisanal bakery look with a cream-and-olive palette.',
  fields: [],
  tokens: {
    colorBg: '#f6f1e6',
    colorSurface: '#fbf8f0',
    colorSurfaceAlt: '#efe7d6',
    colorText: '#2f3336',
    colorHeading: '#2f3336',
    colorTextMuted: '#6a6a5e',
    colorBorder: '#e0d9c5',
    colorPrimary: '#66734a',
    colorPrimaryContrast: '#f6f1e6',
    colorAccent: '#7e8a5e',
    fontHeading: '"Cormorant Garamond", Georgia, serif',
    fontBody: '"Jost", system-ui, sans-serif',
    fontHeadingWeight: '500',
    fontBodyWeight: '400',
    radiusButton: '0',
    radiusCard: '0',
  },
  layout: { header: 'editorial', footer: 'standard' },
  blockSchemes: { hero: 'muted', ctaBanner: 'inverse', testimonials: 'muted' },
}
