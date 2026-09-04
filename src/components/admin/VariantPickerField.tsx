'use client'
import * as React from 'react'
import { useField, useFormFields, FieldLabel, SelectField } from '@payloadcms/ui'
import type { SelectFieldClientComponent } from 'payload'
import { VARIANT_PREVIEWS } from '@/blocks/variant-previews'
import { isPremiumVariant } from '@/blocks/premium'
import { usePremiumEntitlement } from './PremiumEntitlement/PremiumEntitlementClient'
import { parentPathOf } from './variant-path'

/**
 * Resolve a Payload static/label-function field label down to a plain string.
 * `field.label` on a client field is typed `false | LabelFunction | StaticLabel`;
 * `FieldLabel`'s `label` prop only accepts `StaticLabel` (string | Record<string,string>),
 * so `false` / function values are coerced to the fallback rather than passed through raw.
 */
function resolveLabel(label: unknown, fallback: string): string {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    // Localized StaticLabel (Record<string, string>) — prefer English, else first value.
    const record = label as Record<string, string>
    return record.en ?? Object.values(record)[0] ?? fallback
  }
  return fallback
}

/**
 * Visual variant picker for block `variant` select fields. Renders wireframe
 * previews (from VARIANT_PREVIEWS) as a keyboard-accessible radio card grid instead
 * of Payload's default <select> dropdown.
 *
 * The option set is resolved per-block by reading the sibling `blockType` field
 * (same array index) from form state and looking it up in VARIANT_PREVIEWS. Blocks
 * with no registered wireframes fall back to Payload's native SelectField so the
 * picker never breaks a block that hasn't opted in.
 *
 * Premium variants (PREMIUM_VARIANTS) render locked-but-visible for tenants without
 * the entitlement — the currently-saved value is never locked, so a grandfathered
 * tenant can always still save the page.
 */
const VariantPickerField: SelectFieldClientComponent = (props) => {
  const { path, field } = props
  const { value, setValue } = useField<string>({ path })

  // The block slug lives on the sibling `blockType` field at the same array index.
  const parent = parentPathOf(path)
  const blockType = useFormFields(([fields]) => {
    const f = fields[`${parent}.blockType`]
    return (f?.value as string | undefined) ?? undefined
  })

  const { premiumSections: entitled } = usePremiumEntitlement()
  const [hint, setHint] = React.useState<string | null>(null)
  // Freeze the value as it was SAVED WHEN THE FORM LOADED (not the live/current
  // form value). The server's grandfathering rule locks against the saved
  // document, not against in-progress edits, so the UI must match: otherwise a
  // grandfathered tenant who merely clicks another option to preview it would
  // instantly lock their own saved variant and be unable to switch back to it,
  // even though the server would still have allowed the restore.
  const [initialValue] = React.useState(value)

  // A premium variant is locked unless the tenant is entitled — EXCEPT the value
  // already saved on this block, which stays selectable so a grandfathered tenant
  // is never trapped in an unsavable form.
  const isLocked = React.useCallback(
    (v: string) => !entitled && isPremiumVariant(blockType, v) && initialValue !== v,
    [entitled, blockType, initialValue],
  )

  const options = (blockType && VARIANT_PREVIEWS[blockType]) || []
  const label = resolveLabel(field?.label, 'Layout')

  // No wireframes for this block -> fall back to Payload's native select, which has
  // NO locking. Harmless today since every block with a PREMIUM_VARIANTS entry also
  // has a VARIANT_PREVIEWS entry, but a future premium variant added to a block
  // without a preview would render fully unlocked here. If you add Plan 2 variants,
  // make sure any premium one also gets a VARIANT_PREVIEWS entry.
  if (options.length === 0) {
    return <SelectField {...props} />
  }

  const focusCard = (index: number) => {
    const grid = document.getElementById(`variant-picker-${path}`)
    const cards = grid?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    cards?.[index]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    // Step past locked cards; bail out if every other option is locked.
    let next = index
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length
      if (!isLocked(options[next]!.value)) break
    }
    const nextValue = options[next]?.value
    if (!nextValue || isLocked(nextValue)) return
    focusCard(next)
    setValue(nextValue)
  }

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      <FieldLabel label={label} path={path} />
      <div
        id={`variant-picker-${path}`}
        role="radiogroup"
        aria-label="Layout variant"
        // Cap the track max (not 1fr) so previews stay at their natural size regardless of
        // option count — otherwise a 2-option block stretches each preview to half the
        // form width and it balloons vertically. auto-fit still packs the cards from the left.
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 200px))', gap: 10 }}
      >
        {options.map(({ value: v, label: optionLabel, Wireframe }, index) => {
          const selected = value === v
          const locked = isLocked(v)
          return (
            <button
              type="button"
              key={v}
              role="radio"
              aria-checked={selected}
              aria-disabled={locked || undefined}
              tabIndex={selected || (!value && index === 0) ? 0 : -1}
              onClick={() => {
                if (locked) {
                  setHint(v)
                  return
                }
                setHint(null)
                setValue(v)
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{
                textAlign: 'left',
                cursor: locked ? 'not-allowed' : 'pointer',
                padding: 10,
                borderRadius: 8,
                background: 'var(--theme-input-bg, transparent)',
                border: selected
                  ? '2px solid var(--theme-success-500)'
                  : '1px solid var(--theme-elevation-150)',
                position: 'relative',
              }}
            >
              <div style={{ opacity: locked ? 0.45 : 1 }}>
                <Wireframe />
              </div>
              {locked && (
                <span
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--theme-elevation-0)',
                    background: 'var(--theme-elevation-600)',
                    borderRadius: 999,
                    padding: '2px 7px',
                  }}
                >
                  Premium
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: `2px solid ${selected ? 'var(--theme-success-500)' : 'var(--theme-elevation-300)'}`,
                    display: 'inline-block',
                    position: 'relative',
                  }}
                />
                <span
                  style={{ fontSize: 13, color: locked ? 'var(--theme-elevation-400)' : 'var(--theme-text)' }}
                >
                  {optionLabel}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      {hint && options.find((o) => o.value === hint) && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-600)' }}>
          “{options.find((o) => o.value === hint)?.label}” is a Premium design. Upgrade to Growth to use it.
        </div>
      )}
    </div>
  )
}

export default VariantPickerField
