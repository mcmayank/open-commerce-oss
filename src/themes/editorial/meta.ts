import type { ThemeMeta } from '../types'
import { EDITORIAL_SLUG, editorialFields } from './config'

/**
 * Pure metadata + design preset for the Editorial theme — no component/font
 * imports, so the catalog (and thus the Payload config) can describe it safely.
 * Editorial is a token/layout preset over the shared storefront (Slice E): a
 * cool-paper palette with a garnet accent, a serif masthead (the already-loaded
 * Merriweather), sharp corners, a centered header and a minimal footer.
 */
export const editorialMeta: ThemeMeta = {
  slug: EDITORIAL_SLUG,
  label: 'Editorial',
  entitlement: 'free',
  description: 'A magazine-style editorial look for fashion, lifestyle, and curated boutiques.',
  fields: editorialFields,
  tokens: {
    colorBg: '#f7f6f3',
    colorSurface: '#ffffff',
    colorSurfaceAlt: '#efece5',
    colorText: '#16151a',
    colorHeading: '#16151a',
    colorTextMuted: '#6b6a72',
    colorBorder: '#e2e0da',
    colorPrimary: '#16151a',
    colorPrimaryContrast: '#f7f6f3',
    colorAccent: '#7a1f3d',
    fontHeading: '"Merriweather", Georgia, serif',
    radiusButton: '0',
    radiusCard: '0',
  },
  layout: { header: 'centered', footer: 'minimal' },
  blockSchemes: { hero: 'default', ctaBanner: 'inverse', testimonials: 'muted' },
}
