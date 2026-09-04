'use client'
import * as React from 'react'
import { useField } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import { parseMoneyInput, formatMinorForInput } from '@/lib/money-input'
import { formatMoney } from '@/lib/money'

/**
 * Price Field for Products (and variant prices). The merchant types a normal
 * major-unit amount (e.g. 12.50) next to their store's currency symbol, while
 * the stored value stays integer minor units — the app's canonical money shape.
 * Conversion runs through the TDD-covered helpers in src/lib/money-input.ts.
 *
 * The store currency is fetched once (access-scoped to the tenant); until it
 * loads we assume 2-decimal formatting, correct for every currency this store
 * can pick today.
 */

function symbolFor(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

function labelText(label: unknown, fallback: string): string {
  return typeof label === 'string' && label ? label : fallback
}

const MoneyField: NumberFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<number>({ path })
  const [currency, setCurrency] = React.useState('USD')
  // Local text drives the input only while focused; otherwise the displayed
  // value is derived from the stored minor units, so external changes and
  // canonical formatting apply without a state-syncing effect.
  const [text, setText] = React.useState('')
  const [focused, setFocused] = React.useState(false)

  // Fetch the store currency once. Access control scopes this to the tenant.
  React.useEffect(() => {
    let active = true
    void fetch('/api/store-settings?limit=1&depth=0', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const c = d?.docs?.[0]?.currency
        if (active && typeof c === 'string') setCurrency(c)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const label = labelText(field?.label, field?.name ?? 'Price')
  const required = field?.required
  const symbol = symbolFor(currency)
  const display = focused ? text : formatMinorForInput(value, currency)

  const onChange = (raw: string) => {
    setText(raw)
    const minor = parseMoneyInput(raw, currency)
    setValue(minor === null ? undefined : minor)
  }

  return (
    <div className="field-type number" style={{ marginBottom: 20 }}>
      <label className="field-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: 'var(--theme-error-500, #d14343)' }}> *</span>}
      </label>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'stretch',
          maxWidth: 220,
          width: '100%',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--theme-input-bg, transparent)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 10px',
            background: 'var(--theme-elevation-50)',
            borderRight: '1px solid var(--theme-elevation-150)',
            color: 'var(--theme-elevation-600)',
            fontWeight: 600,
            fontSize: '0.9em',
          }}
        >
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          placeholder={formatMinorForInput(0, currency)}
          onFocus={() => {
            setText(formatMinorForInput(value, currency))
            setFocused(true)
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--theme-text)',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          }}
        />
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, margin: '6px 0 0' }}>
        {value != null
          ? `Customers see ${formatMoney(value, currency)}.`
          : 'Enter the price customers pay, e.g. 12.50.'}
      </p>
    </div>
  )
}

export default MoneyField
