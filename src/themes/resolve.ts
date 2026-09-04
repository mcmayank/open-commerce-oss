import type { ThemeFieldDef, ThemeMeta } from './types'

/**
 * Coerce a tenant's stored (untrusted JSON) customization values against a
 * theme's declared field schema. Pure and server/client-safe.
 *
 * For every declared field it returns a well-typed value — applying the field's
 * `default` when the stored value is missing or invalid — and it drops any key
 * the theme did not declare. Storefront components read the result instead of
 * ever touching the raw JSON, so a bad value can never reach render.
 */
export type ResolvedThemeValue = string | number | boolean | null

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const hex = (v: unknown): string | null => (typeof v === 'string' && HEX.test(v) ? v : null)

function resolveField(field: ThemeFieldDef, raw: unknown): ResolvedThemeValue {
  switch (field.type) {
    case 'color':
      return hex(raw) ?? hex(field.default) ?? null

    case 'text':
    case 'textarea': {
      const s =
        typeof raw === 'string'
          ? raw
          : typeof field.default === 'string'
            ? field.default
            : ''
      return field.maxLength != null ? s.slice(0, field.maxLength) : s
    }

    case 'select': {
      const allowed = new Set((field.options ?? []).map((o) => o.value))
      if (typeof raw === 'string' && allowed.has(raw)) return raw
      if (typeof field.default === 'string' && allowed.has(field.default)) return field.default
      return field.options?.[0]?.value ?? null
    }

    case 'media':
      return typeof raw === 'string' && raw.length > 0 ? raw : null

    case 'boolean':
      return typeof raw === 'boolean' ? raw : typeof field.default === 'boolean' ? field.default : false

    case 'number': {
      const n =
        typeof raw === 'number' && Number.isFinite(raw)
          ? raw
          : typeof field.default === 'number'
            ? field.default
            : (field.min ?? 0)
      const lo = field.min ?? -Infinity
      const hi = field.max ?? Infinity
      return Math.min(hi, Math.max(lo, n))
    }
  }
}

export function resolveThemeValues(
  meta: ThemeMeta,
  raw: unknown,
): Record<string, ResolvedThemeValue> {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Record<string, ResolvedThemeValue> = {}
  for (const field of meta.fields) {
    out[field.name] = resolveField(field, source[field.name])
  }
  return out
}
