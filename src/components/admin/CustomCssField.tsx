'use client'
import * as React from 'react'
import { useField } from '@payloadcms/ui'
import type { TextareaFieldClientComponent } from 'payload'
import { usePremiumEntitlement } from './PremiumEntitlement/PremiumEntitlementClient'

const DOCS_URL = 'https://niblr.store/docs/custom-css'

function labelText(label: unknown, fallback: string): string {
  if (typeof label === 'string' && label) return label
  return fallback
}

/**
 * Locked-but-visible Field for the StoreSettings `customCss` textarea. Custom CSS
 * is Premium, enforced server-side by `assertCustomCss`
 * (src/lib/plan-enforcement.ts) in StoreSettings' `beforeChange`. Without this
 * component the field has no `admin.condition`, so every merchant on every plan
 * sees a plain, editable textarea — a free-tier merchant who types CSS and hits
 * Save gets a 403 from `beforeChange`, which fails the WHOLE document save
 * (losing any unrelated edits, e.g. a store-name change, made in the same
 * sitting), with no signal beforehand that the field was unusable.
 *
 * Entitled tenants get the ordinary textarea, unchanged. Non-entitled tenants
 * get the same textarea, disabled, plus a short note pointing at the public
 * docs — so they learn it's Premium before typing, not after losing work.
 * Existing CSS is always left visible in both states: a store that was Premium
 * and got downgraded still has that CSS actively applying to its storefront,
 * and hiding it would leave the merchant unable to see what is styling their
 * own site.
 *
 * The disabled state is an affordance only, not the security boundary —
 * `assertCustomCss` is untouched and stays the real guard, since a determined
 * caller can still POST directly to the API.
 *
 * The sibling `customCssEnabled` checkbox (StoreSettings.ts) is deliberately
 * NOT rendered by this component and is not plan-gated at all — it is the
 * escape hatch that lets a downgraded store switch its CSS off, or clear it,
 * without Premium (assertCustomCss returns early for an unchanged or empty
 * value). Nothing here disables it.
 */
const CustomCssField: TextareaFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string>({ path })
  const { customCss: entitled } = usePremiumEntitlement()
  const label = labelText(field?.label, 'Custom CSS')
  const desc = typeof field?.admin?.description === 'string' ? field.admin.description : undefined
  // Programmatic label association: FieldLabel (used by VariantPickerField) derives
  // its htmlFor from generateFieldID(path, editDepth, formUuid), which pulls in
  // useForm/useEditDepth/useLocale/useTranslation — four more Payload contexts this
  // component would otherwise have no reason to touch. A plain, path-derived id is
  // sufficient here and keeps the component's only Payload dependency at useField.
  const inputId = `custom-css-field-${path}`

  return (
    <div className="field-type textarea" style={{ marginBottom: 20 }}>
      <label
        htmlFor={inputId}
        className="field-label"
        style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}
      >
        {label}
      </label>
      <textarea
        id={inputId}
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value)}
        disabled={!entitled}
        rows={14}
        style={{
          width: '100%',
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 13,
          padding: '8px 10px',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 8,
          background: entitled ? 'var(--theme-input-bg, transparent)' : 'var(--theme-elevation-50)',
          color: entitled ? 'var(--theme-text)' : 'var(--theme-elevation-500)',
          cursor: entitled ? 'text' : 'not-allowed',
        }}
      />
      {desc && <p style={{ fontSize: 12, opacity: 0.7, margin: '6px 0 0' }}>{desc}</p>}
      {!entitled && (
        <p style={{ fontSize: 12, color: 'var(--theme-elevation-600)', margin: '6px 0 0' }}>
          Custom CSS is a Premium feature. <a href="/admin/settings/plan">Upgrade to Growth</a> to edit it —{' '}
          <a href={DOCS_URL} target="_blank" rel="noreferrer">
            see what it does
          </a>
          .
        </p>
      )}
    </div>
  )
}

export default CustomCssField
