import type { ThemeFieldDef } from '@/themes/types'

/** In-memory shape of the `themeCustomizations` JSON field, keyed by theme slug. */
export type Customizations = Record<string, Record<string, unknown>>

/** The current stored value for a field, or the theme's declared default when
 *  the tenant hasn't set it yet. Pure — drives what each input shows. */
export function readThemeValue(
  current: Customizations | null | undefined,
  slug: string,
  field: ThemeFieldDef,
): unknown {
  const stored = current?.[slug]?.[field.name]
  return stored !== undefined ? stored : field.default
}

/** Immutably set one field's value under a theme slug, preserving every other
 *  slug and field (so switching themes never drops the other theme's config). */
export function setThemeValue(
  current: Customizations | null | undefined,
  slug: string,
  name: string,
  value: unknown,
): Customizations {
  const base = current && typeof current === 'object' ? current : {}
  const slugValues = base[slug] && typeof base[slug] === 'object' ? base[slug] : {}
  return { ...base, [slug]: { ...slugValues, [name]: value } }
}

/** Convert a raw DOM input value to the field's stored type. */
export function parseInputValue(field: ThemeFieldDef, raw: string | boolean): unknown {
  if (field.type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) && raw !== '' ? n : undefined
  }
  if (field.type === 'boolean') return Boolean(raw)
  return raw
}
