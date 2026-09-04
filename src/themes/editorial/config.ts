import type { StoreSetting } from '@/payload-types'
import type { ThemeFieldDef, ThemeMeta } from '../types'
import { resolveThemeValues } from '../resolve'

/** Slug this theme registers under (Tenants.storefrontTheme / catalog). */
export const EDITORIAL_SLUG = 'editorial'

/**
 * The tenant-customizable options this template exposes. The dashboard renders
 * a form from this list; the storefront reads validated values back out. Keep
 * this file pure (no fonts/components) — meta.ts and the catalog import it.
 */
export const editorialFields: ThemeFieldDef[] = [
  {
    name: 'heroHeadline',
    type: 'text',
    label: 'Hero headline',
    description: 'The masthead line over your cover image.',
    maxLength: 60,
    default: 'The New Arrivals',
  },
  {
    name: 'heroSubheading',
    type: 'textarea',
    label: 'Hero subheading',
    maxLength: 180,
    default: 'A considered edit of pieces for the season ahead.',
  },
  {
    name: 'heroImageUrl',
    type: 'text',
    label: 'Cover image URL',
    description: 'A wide, high-resolution image. Leave blank for a typographic cover.',
    maxLength: 500,
  },
  {
    name: 'accentColor',
    type: 'color',
    label: 'Accent color',
    description: 'Used for the issue mark, links, and buttons.',
    default: '#7a1f3d',
  },
  {
    name: 'heroStyle',
    type: 'select',
    label: 'Cover style',
    default: 'full-bleed',
    options: [
      { label: 'Full bleed', value: 'full-bleed' },
      { label: 'Framed', value: 'framed' },
    ],
  },
  {
    name: 'showLookbook',
    type: 'boolean',
    label: 'Show the lookbook strip',
    default: true,
  },
  {
    name: 'galleryColumns',
    type: 'number',
    label: 'Gallery columns',
    default: 3,
    min: 2,
    max: 4,
  },
]

export interface EditorialConfig {
  heroHeadline: string
  heroSubheading: string
  heroImageUrl: string | null
  accentColor: string
  heroStyle: 'full-bleed' | 'framed'
  showLookbook: boolean
  galleryColumns: number
}

const resolverMeta: ThemeMeta = {
  slug: EDITORIAL_SLUG,
  label: 'Editorial',
  entitlement: 'free',
  fields: editorialFields,
}

/**
 * Read a tenant's Editorial customizations off StoreSettings, coerced and
 * defaulted to a concrete, render-safe config. The storefront components read
 * this — never the raw JSON.
 */
export function readEditorialConfig(settings: StoreSetting | null): EditorialConfig {
  const raw =
    (settings?.themeCustomizations as Record<string, unknown> | null | undefined)?.[EDITORIAL_SLUG]
  const v = resolveThemeValues(resolverMeta, raw)
  return {
    heroHeadline: String(v.heroHeadline),
    heroSubheading: String(v.heroSubheading),
    heroImageUrl: (v.heroImageUrl as string) || null,
    accentColor: (v.accentColor as string) ?? '#7a1f3d',
    heroStyle: v.heroStyle === 'framed' ? 'framed' : 'full-bleed',
    showLookbook: v.showLookbook === true,
    galleryColumns: typeof v.galleryColumns === 'number' ? v.galleryColumns : 3,
  }
}
