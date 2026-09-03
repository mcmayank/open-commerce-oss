'use client'
import * as React from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import { safeSlugify } from '@/lib/slug'

type FormFields = Record<string, { value?: unknown } | undefined>

function stringField(fields: FormFields, name: string): string {
  const v = fields[name]?.value
  return typeof v === 'string' ? v : ''
}

/**
 * The `slug` input for Products: a normal text field that previews the slug the
 * server will generate.
 *
 * IMPORTANT — this component deliberately holds NO state and performs NO writes
 * of its own. Payload remounts field components on every form write, which
 * resets `useState` and `useRef`. An earlier version tracked "has the merchant
 * edited this" and "what did we last derive" in component state; both were
 * wiped on each write, so the effect fired again, wrote again, and the admin
 * died with "Maximum update depth exceeded". Measured with mount counters:
 * 3 mounts / 2 unmounts for a single write, with the ref back to null.
 *
 * Derivation therefore lives on the server, in the Products `beforeValidate`
 * hook, which fills an empty slug from the title. All this component does is
 * show what that will produce, via the placeholder. `setValue` is called only
 * from the merchant's own `onChange` — never from an effect — so there is no
 * loop to have.
 */
const SlugField: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string>({ path })
  const fields = useFormFields(([f]) => f) as FormFields

  // Display only. Never written anywhere.
  const preview = safeSlugify(stringField(fields, 'title')) ?? ''

  const label = typeof field?.label === 'string' && field.label ? field.label : 'Slug'
  const required = Boolean(field?.required)

  return (
    <div className="field-type text" style={{ marginBottom: 20 }}>
      <label
        className="field-label"
        htmlFor={`field-${path}`}
        style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}
      >
        {label}
        {required && <span style={{ color: 'var(--theme-error-500, #d14343)' }}> *</span>}
      </label>
      <input
        id={`field-${path}`}
        type="text"
        value={value ?? ''}
        placeholder={preview}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--theme-elevation-150)',
          background: 'var(--theme-input-bg, transparent)',
          color: 'var(--theme-text)',
        }}
      />
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        {value
          ? 'Your store URL for this product. Changing it breaks existing links.'
          : preview
            ? `Leave blank and we'll use “${preview}”.`
            : 'Filled in from the title when you save. Type here to choose your own.'}
      </p>
    </div>
  )
}

export default SlugField
