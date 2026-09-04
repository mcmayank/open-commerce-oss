'use client'
import * as React from 'react'
import { useField, useFormFields, FieldLabel } from '@payloadcms/ui'
import type { ArrayFieldClientComponent } from 'payload'
import { deriveVariantTitle } from '@/lib/variants'

type OptionValue = { option: string; value: string }
type Axis = { name: string; values?: { value: string }[] }

type FormFields = Record<string, { value?: unknown; rows?: unknown[] } | undefined>

/**
 * Number of rows an array field currently has, per Payload's form state.
 *
 * `addFieldStatePromise` stores `value = arrayValue.length` for array fields —
 * a NUMBER, not the contents — and keeps row identity in `rows`. Reading
 * `.value` and treating it as an array is why this component used to throw
 * `options.map is not a function` as soon as a product had one option.
 */
function rowCount(field: FormFields[string]): number {
  if (Array.isArray(field?.rows)) return field.rows.length
  return typeof field?.value === 'number' ? field.value : 0
}

/**
 * Rebuild the `options` array from the flattened paths Payload actually exposes:
 * `options.0.name`, `options.0.values.0.value`, and so on.
 *
 * Exported for test. Axes without a name yet (the user is still typing one) are
 * skipped rather than rendered as a nameless select.
 */
export function readAxes(fields: FormFields): Axis[] {
  const axes: Axis[] = []
  for (let i = 0; i < rowCount(fields['options']); i++) {
    const name = fields[`options.${i}.name`]?.value
    if (typeof name !== 'string' || name === '') continue
    const values: { value: string }[] = []
    for (let j = 0; j < rowCount(fields[`options.${i}.values`]); j++) {
      const v = fields[`options.${i}.values.${j}.value`]?.value
      if (typeof v === 'string' && v !== '') values.push({ value: v })
    }
    axes.push({ name, values })
  }
  return axes
}

/**
 * Renders one <select> per product option axis (Size, Color, …) inside a variant row,
 * writing the row's `optionValues` as `{ option, value }[]`. The axis list is read live
 * from the sibling top-level `options` field. When no axes are defined, prompts the user
 * to define options first (the variant's `title` field is used directly in that case).
 */
const VariantOptionValues: ArrayFieldClientComponent = ({ path }) => {
  const { value, setValue } = useField<OptionValue[]>({ path })
  // Select the whole fields object and derive outside the selector: `readAxes`
  // builds a fresh array every call, and returning that straight from
  // `useFormFields` would defeat its equality check on every keystroke.
  const fields = useFormFields(([f]) => f) as FormFields
  const options = React.useMemo(() => readAxes(fields), [fields])

  const current: OptionValue[] = Array.isArray(value) ? value : []
  const valueFor = (axis: string) => current.find((o) => o.option === axis)?.value ?? ''

  const setAxis = (axis: string, v: string) => {
    const next = options
      .map((ax) => {
        const chosen = ax.name === axis ? v : valueFor(ax.name)
        return chosen ? { option: ax.name, value: chosen } : null
      })
      .filter((o): o is OptionValue => o !== null)
    setValue(next)
  }

  if (!options || options.length === 0) {
    return (
      <div className="field-type" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Define product options above to tag this variant. Without options, use the Title field.
        </p>
      </div>
    )
  }

  const label = deriveVariantTitle(
    current,
    options.map((a) => ({ name: a.name, values: a.values ?? [] })),
  )

  return (
    <div className="field-type" style={{ marginBottom: 12 }}>
      <FieldLabel label="Options" path={path} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {options.map((axis) => (
          <label key={axis.name} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--theme-elevation-600)' }}>{axis.name}</span>
            <select
              value={valueFor(axis.name)}
              onChange={(e) => setAxis(axis.name, e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--theme-elevation-150)',
                background: 'var(--theme-input-bg, transparent)',
                color: 'var(--theme-text)',
              }}
            >
              <option value="">—</option>
              {(axis.values ?? []).map((val) => (
                <option key={val.value} value={val.value}>
                  {val.value}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {label && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Variant label: <strong>{label}</strong>
        </p>
      )}
    </div>
  )
}

export default VariantOptionValues
