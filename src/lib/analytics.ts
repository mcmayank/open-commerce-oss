
/** GA4 Measurement ID, e.g. G-ABCDE12345. */
export const GA4_ID_RE = /^G-[A-Z0-9]{4,}$/
/** Google Tag Manager container ID, e.g. GTM-ABC123. */
export const GTM_ID_RE = /^GTM-[A-Z0-9]+$/

// Marketing pixels. Every regex is anchored and restricted to a safe character
// class (letters/digits/hyphen only) so a stored id can never contain markup and
// break out of the snippet it's interpolated into.
export const META_PIXEL_RE = /^\d{10,20}$/
export const TIKTOK_PIXEL_RE = /^[A-Z0-9]{16,24}$/
export const PINTEREST_TAG_RE = /^\d{10,20}$/
export const SNAPCHAT_PIXEL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const GOOGLE_ADS_RE = /^AW-\d{9,12}$/
export const CLARITY_RE = /^[a-z0-9]{8,15}$/
export const HOTJAR_RE = /^\d{6,10}$/

export type GaItem = {
  item_id: string
  item_name: string
  price: number
  quantity?: number
}

export type AnalyticsIds = {
  ga4MeasurementId?: string
  gtmContainerId?: string
  metaPixelId?: string
  tiktokPixelId?: string
  pinterestTagId?: string
  snapchatPixelId?: string
  googleAdsId?: string
  clarityProjectId?: string
  hotjarId?: string
}

/** The stored-field name → validating regex map. Single source of truth for
 *  both the field validators and the read-time re-validation below. */
export const ANALYTICS_ID_RULES: Record<keyof AnalyticsIds, RegExp> = {
  ga4MeasurementId: GA4_ID_RE,
  gtmContainerId: GTM_ID_RE,
  metaPixelId: META_PIXEL_RE,
  tiktokPixelId: TIKTOK_PIXEL_RE,
  pinterestTagId: PINTEREST_TAG_RE,
  snapchatPixelId: SNAPCHAT_PIXEL_RE,
  googleAdsId: GOOGLE_ADS_RE,
  clarityProjectId: CLARITY_RE,
  hotjarId: HOTJAR_RE,
}

/** Minor units (e.g. 1000 = 10.00) → major decimal for GA4 `value`/`price`. */
export function toMajor(minor: number): number {
  return Math.round(minor) / 100
}

/**
 * Read + re-validate a stored `analytics` group. Every id is re-checked against
 * its regex here (defense in depth beyond the field validator), so a malformed
 * or tampered value is dropped and can never inject a broken/unsafe tag. Returns
 * only well-formed ids.
 */
export function readAnalytics(source: unknown): AnalyticsIds {
  if (!source || typeof source !== 'object') return {}
  const s = source as Record<string, unknown>
  const out: AnalyticsIds = {}
  for (const [key, re] of Object.entries(ANALYTICS_ID_RULES) as [keyof AnalyticsIds, RegExp][]) {
    const raw = typeof s[key] === 'string' ? (s[key] as string).trim() : ''
    if (raw && re.test(raw)) out[key] = raw
  }
  return out
}
