import { getThemeMeta } from '@/themes/catalog'
import type { ThemeFieldDef, ThemeMeta } from '@/themes/types'

/**
 * Sanitize a tenant's `themeCustomizations` JSON before it is persisted.
 *
 * The field is free-form JSON, so this is the single validation choke point for
 * StoreSettings. It keeps only entries for known theme slugs, keeps only fields
 * each theme declares, and keeps only *valid* provided values — invalid ones are
 * dropped rather than persisted. Defaults are intentionally NOT filled in here:
 * absent fields fall back to the theme's current default at read time
 * (resolveThemeValues), so changing a default later still takes effect.
 *
 * Throws when the serialized result would exceed the size cap, so a direct API
 * write cannot bloat the tenant singleton.
 */
export type StoredThemeValue = string | number | boolean
export type ThemeCustomizations = Record<string, Record<string, StoredThemeValue>>

const MAX_BYTES = 12 * 1024
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Clean one provided value against its declared field. Returns `undefined` to
 *  signal "drop this field" (missing or invalid). */
function cleanValue(field: ThemeFieldDef, raw: unknown): StoredThemeValue | undefined {
  switch (field.type) {
    case 'color':
      return typeof raw === 'string' && HEX.test(raw) ? raw : undefined

    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') return undefined
      return field.maxLength != null ? raw.slice(0, field.maxLength) : raw
    }

    case 'select': {
      const allowed = new Set((field.options ?? []).map((o) => o.value))
      return typeof raw === 'string' && allowed.has(raw) ? raw : undefined
    }

    case 'media':
      return typeof raw === 'string' && raw.length > 0 ? raw : undefined

    case 'boolean':
      return typeof raw === 'boolean' ? raw : undefined

    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
      const lo = field.min ?? -Infinity
      const hi = field.max ?? Infinity
      return Math.min(hi, Math.max(lo, raw))
    }
  }
}

function cleanThemeEntry(meta: ThemeMeta, value: unknown): Record<string, StoredThemeValue> {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const out: Record<string, StoredThemeValue> = {}
  for (const field of meta.fields) {
    const cleaned = cleanValue(field, source[field.name])
    if (cleaned !== undefined) out[field.name] = cleaned
  }
  return out
}

export function sanitizeThemeCustomizations(
  raw: unknown,
  resolveMeta: (slug: string) => ThemeMeta | null = getThemeMeta,
): ThemeCustomizations {
  if (!raw || typeof raw !== 'object') return {}
  const out: ThemeCustomizations = {}
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    const meta = resolveMeta(slug)
    if (!meta || meta.fields.length === 0) continue
    const entry = cleanThemeEntry(meta, value)
    if (Object.keys(entry).length > 0) out[slug] = entry
  }
  if (JSON.stringify(out).length > MAX_BYTES) {
    throw new Error('Theme customizations are too large.')
  }
  return out
}
