import type { Field } from 'payload'
import { ANALYTICS_ID_RULES } from '@/lib/analytics'

/** Curated marketing-pixel fields (name → label/help/example). Each is a public,
 *  non-secret id, validated by the shared regex in `ANALYTICS_ID_RULES` so it can
 *  never carry raw markup into the rendered snippet. */
const PIXEL_FIELDS: { name: keyof typeof ANALYTICS_ID_RULES; label: string; description: string }[] = [
  { name: 'metaPixelId', label: 'Meta (Facebook) Pixel ID', description: 'Numeric ID from Meta Events Manager (e.g. 123456789012345).' },
  { name: 'tiktokPixelId', label: 'TikTok Pixel ID', description: 'From TikTok Ads → Events → Web Events (e.g. C1A2B3...).' },
  { name: 'pinterestTagId', label: 'Pinterest Tag ID', description: 'From Pinterest Ads → Conversions (numeric tag ID).' },
  { name: 'snapchatPixelId', label: 'Snapchat Pixel ID', description: 'The UUID from Snapchat Ads → Events Manager.' },
  { name: 'googleAdsId', label: 'Google Ads Conversion ID', description: 'e.g. AW-123456789 — from Google Ads → Conversions.' },
  { name: 'clarityProjectId', label: 'Microsoft Clarity Project ID', description: 'From clarity.microsoft.com → Settings (free heatmaps/recordings).' },
  { name: 'hotjarId', label: 'Hotjar Site ID', description: 'Numeric Site ID from your Hotjar account.' },
]

/**
 * Shared Analytics + marketing-pixel field group, used by the platform settings global
 * (marketing site) and StoreSettings (per-tenant storefront). Every value is a
 * public, non-secret id (plaintext, empty = disabled). For any tracker not
 * listed here, use Google Tag Manager (the GTM Container ID above).
 */
export const analyticsGroup: Field = {
  name: 'analytics',
  type: 'group',
  label: 'Analytics & pixels',
  admin: {
    description:
      'Analytics and marketing pixels. Each is an ID only — we render the official snippet for you. Leave blank to disable. For anything not listed, add it via your GTM container.',
  },
  fields: [
    {
      name: 'ga4MeasurementId',
      type: 'text',
      label: 'GA4 Measurement ID',
      admin: { description: 'e.g. G-XXXXXXXXXX — from GA Admin → Data Streams.' },
      validate: (value: string | null | undefined) =>
        !value || ANALYTICS_ID_RULES.ga4MeasurementId.test(value) || 'Must look like G-XXXXXXXX (uppercase letters/digits).',
    },
    {
      name: 'gtmContainerId',
      type: 'text',
      label: 'GTM Container ID',
      admin: { description: 'e.g. GTM-XXXXXX — use this to add any tag not listed below.' },
      validate: (value: string | null | undefined) =>
        !value || ANALYTICS_ID_RULES.gtmContainerId.test(value) || 'Must look like GTM-XXXXXX.',
    },
    ...PIXEL_FIELDS.map(
      (p): Field => ({
        name: p.name,
        type: 'text',
        label: p.label,
        admin: { description: p.description },
        validate: (value: string | null | undefined) =>
          !value || ANALYTICS_ID_RULES[p.name].test(value) || `That doesn't look like a valid ${p.label}.`,
      }),
    ),
  ],
}
