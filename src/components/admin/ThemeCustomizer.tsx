'use client'
import * as React from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import { getThemeMeta } from '@/themes/catalog'
import type { ThemeFieldDef } from '@/themes/types'
import { parseInputValue, readThemeValue, setThemeValue, type Customizations } from './theme-customizer/state'
import { storeIdOf } from '@/store-scope'

/**
 * Dynamic per-template customization form, rendered as a `ui` field on
 * StoreSettings. It reads the tenant's currently-selected `storefrontTheme`
 * (fetched from the Tenants doc referenced by this settings row), looks up that
 * theme's declared `fields` from the pure catalog, and renders one input per
 * field — writing values into the `themeCustomizations` JSON field, namespaced
 * by theme slug so switching templates never drops another template's config.
 *
 * The JSON is sanitized server-side (StoreSettings beforeValidate), so this UI
 * is convenience, not the security boundary.
 */
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }
const descStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, transparent)',
  color: 'var(--theme-text)',
}

const ThemeCustomizer: UIFieldClientComponent = () => {
  const tenantId = useFormFields(([fields]) => storeIdOf({ tenant: fields?.tenant?.value }))
  const { value, setValue } = useField<Customizations>({ path: 'themeCustomizations' })

  const [slug, setSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!tenantId) return
    let active = true
    void fetch(`/api/tenants/${tenantId}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: { storefrontTheme?: string } | null) => {
        if (active) setSlug(doc?.storefrontTheme ?? 'default')
      })
      .catch(() => {
        if (active) setSlug('default')
      })
    return () => {
      active = false
    }
  }, [tenantId])

  // Loading only while a tenant exists but its theme hasn't resolved yet.
  const loading = Boolean(tenantId) && slug === null
  const meta = slug ? getThemeMeta(slug) : null

  const update = (field: ThemeFieldDef, raw: string | boolean) => {
    if (!slug) return
    setValue(setThemeValue(value, slug, field.name, parseInputValue(field, raw)))
  }

  if (loading) {
    return <div style={{ fontSize: 13, opacity: 0.7 }}>Loading template options…</div>
  }
  if (!tenantId) {
    return <div style={{ fontSize: 13, opacity: 0.7 }}>Save your store settings to customize your template.</div>
  }
  if (!meta || meta.fields.length === 0) {
    return (
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        The <strong>{meta?.label ?? slug}</strong> template has no customizable options.
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 4, padding: 12, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Customize the {meta.label} template</div>
      <div style={{ ...descStyle, marginBottom: 14 }}>
        These options apply only to the {meta.label} template. Switching templates keeps each one’s settings.
      </div>
      {meta.fields.map((field) => {
        const current = readThemeValue(value, meta.slug, field)
        return (
          <div key={field.name} style={{ marginBottom: 14 }}>
            {field.type !== 'boolean' && <label style={labelStyle}>{field.label}</label>}
            {field.description && field.type !== 'boolean' && <div style={descStyle}>{field.description}</div>}
            <FieldInput field={field} value={current} onChange={(raw) => update(field, raw)} inputStyle={inputStyle} />
          </div>
        )
      })}
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
  inputStyle,
}: {
  field: ThemeFieldDef
  value: unknown
  onChange: (raw: string | boolean) => void
  inputStyle: React.CSSProperties
}) {
  switch (field.type) {
    case 'color':
      return (
        <input
          type="color"
          value={typeof value === 'string' ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, width: 56, height: 34, padding: 2 }}
        />
      )
    case 'textarea':
      return (
        <textarea
          value={typeof value === 'string' ? value : ''}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      )
    case 'select':
      return (
        <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      )
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, width: 120 }}
        />
      )
    case 'media':
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder="Media ID"
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )
    case 'text':
    default:
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )
  }
}

export default ThemeCustomizer
