import { describe, expect, it } from 'vitest'
import { StoreSettings } from './StoreSettings'

/**
 * A `defaultValue` on a branding field is persisted into the row on first save
 * and then beats the theme preset in `resolveTokens` forever. That is how
 * choosing a theme stopped changing how a store looked. Nothing else in the
 * suite would notice one coming back, so this test is the guard.
 */

type AnyField = {
  name?: string
  type?: string
  fields?: AnyField[]
  tabs?: { fields?: AnyField[] }[]
  defaultValue?: unknown
  options?: unknown[]
}

/** Depth-first walk of tabs and groups to the `theme` group's own fields. */
function findGroup(fields: AnyField[], name: string): AnyField | null {
  for (const f of fields) {
    if (f.name === name && f.type === 'group') return f
    for (const nested of [f.fields, ...(f.tabs ?? []).map((t) => t.fields)]) {
      if (nested) {
        const hit = findGroup(nested, name)
        if (hit) return hit
      }
    }
  }
  return null
}

const themeGroup = findGroup(StoreSettings.fields as AnyField[], 'theme')

describe('StoreSettings branding group', () => {
  it('exists', () => {
    expect(themeGroup).not.toBeNull()
    expect(themeGroup!.fields!.length).toBeGreaterThan(0)
  })

  // The regression guard.
  it('declares no defaultValue on any branding field', () => {
    const offenders = themeGroup!
      .fields!.filter((f) => f.defaultValue !== undefined)
      .map((f) => `${f.name} = ${JSON.stringify(f.defaultValue)}`)
    expect(offenders, 'a branding defaultValue overrides the theme preset').toEqual([])
  })

  it('lets the branding select express inheritance', () => {
    for (const name of ['buttonRadius']) {
      const field = themeGroup!.fields!.find((f) => f.name === name)
      expect(field, `${name} missing`).toBeTruthy()
      const values = (field!.options as { value?: string }[]).map((o) =>
        typeof o === 'string' ? o : o.value,
      )
      expect(values, `${name} has no empty option`).toContain('')
    }
  })

  // buttonRadius backs a Postgres enum column with no '' member — the
  // sentinel must be normalised to NULL in beforeChange, not stored as-is.
  it('maps the inherit sentinel to null before it reaches the enum column', () => {
    for (const name of ['buttonRadius']) {
      const field = themeGroup!.fields!.find((f) => f.name === name) as {
        hooks?: { beforeChange?: ((a: { value: unknown }) => unknown)[] }
      }
      const hook = field.hooks?.beforeChange?.[0]
      expect(hook, `${name} has no beforeChange hook`).toBeTypeOf('function')
      expect(hook!({ value: '' }), `${name} must null the sentinel`).toBeNull()
      expect(hook!({ value: 'md' }), `${name} must pass real values through`).toBe('md')
    }
  })

  // fontFamily moved from a Postgres enum select to a varchar text field so it
  // can hold real Google Font family names. The '' → null normalisation (and
  // the catalog validation) now happens once, in the collection-level
  // resolveThemeFonts beforeValidate hook (see StoreSettings.fonts.test.ts),
  // so the field itself carries no field-level hooks.
  it('fontFamily is a text field with no field-level hooks', () => {
    const field = themeGroup!.fields!.find((f) => f.name === 'fontFamily') as {
      type?: string
      hooks?: unknown
    }
    expect(field, 'fontFamily missing').toBeTruthy()
    expect(field.type, 'fontFamily must be a text field now').toBe('text')
    expect(field.hooks, 'fontFamily must have no field-level hooks').toBeUndefined()
  })
})
