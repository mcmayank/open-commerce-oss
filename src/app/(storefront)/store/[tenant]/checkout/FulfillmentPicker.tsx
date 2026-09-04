'use client'

import React from 'react'

export type FulfillmentUIConfig = {
  pickupEnabled: boolean
  deliveryEnabled: boolean
  pickupLocationLabel?: string
  /** Offered days, computed server-side (authoritative re-check at submit). */
  dates: Array<{ iso: string; label: string }>
  pickupWindows: string[]
  deliveryWindows: string[]
  zones: Array<{ name: string; feeMinor: number; feeFormatted: string; areasNote?: string }>
}

export type FulfillmentMethodValue = 'pickup' | 'delivery'

interface FulfillmentPickerProps {
  config: FulfillmentUIConfig
  method: FulfillmentMethodValue
  onMethodChange: (method: FulfillmentMethodValue) => void
  zoneName: string
  onZoneChange: (zone: string) => void
  fieldErrors?: Partial<Record<string, string>>
  /** Visual tone — 'default' storefront grays, 'sdb' bakery palette. */
  tone?: 'default' | 'sdb'
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-sm text-red-600">{msg}</p>
}

const TONES = {
  default: {
    fieldset: 'rounded-xl border border-gray-200 bg-white p-6',
    legend: 'mb-4 text-base font-semibold text-gray-900',
    methodActive: 'border-gray-900 bg-gray-900 text-white',
    methodIdle: 'border-gray-300 text-gray-700 hover:bg-gray-50',
    label: 'block text-sm font-medium text-gray-700',
    input:
      'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none',
    chip: 'flex cursor-pointer items-center rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors has-[:checked]:border-gray-900 has-[:checked]:bg-gray-900 has-[:checked]:text-white hover:bg-gray-50',
    note: 'text-sm text-gray-600',
    noteStrong: 'text-gray-800',
  },
  sdb: {
    fieldset: 'rounded-[4px] border border-(--sdb-card-border) bg-(--sdb-card) p-6',
    legend: 'sdb-display mb-4 text-xl font-medium text-(--sdb-ink)',
    methodActive: 'border-(--sdb-olive) bg-(--sdb-olive) text-(--sdb-cream)',
    methodIdle: 'border-(--sdb-border) text-(--sdb-slate) hover:border-(--sdb-olive) hover:text-(--sdb-olive)',
    label: 'block text-sm font-medium text-(--sdb-slate)',
    input:
      'mt-1 block w-full rounded-[2px] border border-[#cfc7b1] bg-transparent px-3 py-2 text-sm text-(--sdb-slate) focus:border-(--sdb-olive) focus:outline-none',
    chip: 'flex cursor-pointer items-center rounded-full border border-(--sdb-border) px-4 py-1.5 text-sm text-(--sdb-slate) transition-colors has-[:checked]:border-(--sdb-olive) has-[:checked]:bg-(--sdb-olive) has-[:checked]:text-(--sdb-cream) hover:border-(--sdb-olive)',
    note: 'text-sm font-light text-(--sdb-muted)',
    noteStrong: 'text-(--sdb-ink)',
  },
} as const

/**
 * Pickup/delivery scheduling section for checkout forms. Controlled: the
 * parent form owns the method + zone so it can hide address fields and show
 * the delivery fee in its order summary.
 */
export default function FulfillmentPicker({
  config,
  method,
  onMethodChange,
  zoneName,
  onZoneChange,
  fieldErrors,
  tone = 'default',
}: FulfillmentPickerProps) {
  const windows = method === 'pickup' ? config.pickupWindows : config.deliveryWindows
  const bothMethods = config.pickupEnabled && config.deliveryEnabled
  const t = TONES[tone]

  return (
    <fieldset className={t.fieldset}>
      <legend className={t.legend}>
        {bothMethods ? 'Pickup or delivery' : config.pickupEnabled ? 'Pickup' : 'Delivery'}
      </legend>

      <div className="space-y-4">
        {/* Method toggle */}
        {bothMethods && (
          <div role="radiogroup" aria-label="Fulfilment method" className="grid grid-cols-2 gap-2">
            {(['pickup', 'delivery'] as const).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  method === m ? t.methodActive : t.methodIdle
                }`}
              >
                <input
                  type="radio"
                  name="fulfillmentMethod"
                  value={m}
                  checked={method === m}
                  onChange={() => onMethodChange(m)}
                  className="sr-only"
                />
                {m === 'pickup' ? 'Pickup' : 'Local delivery'}
              </label>
            ))}
          </div>
        )}
        {!bothMethods && (
          <input
            type="hidden"
            name="fulfillmentMethod"
            value={config.pickupEnabled ? 'pickup' : 'delivery'}
          />
        )}
        <FieldError msg={fieldErrors?.fulfillmentMethod} />

        {method === 'pickup' && config.pickupLocationLabel && (
          <p className={t.note}>
            Collect from <strong className={t.noteStrong}>{config.pickupLocationLabel}</strong>
          </p>
        )}

        {/* Delivery zone */}
        {method === 'delivery' && (
          <div>
            <label htmlFor="deliveryZone" className={t.label}>
              Delivery area <span className="text-red-500">*</span>
            </label>
            <select
              id="deliveryZone"
              name="deliveryZone"
              value={zoneName}
              onChange={(e) => onZoneChange(e.target.value)}
              className={t.input}
            >
              <option value="">Choose an area…</option>
              {config.zones.map((z) => (
                <option key={z.name} value={z.name}>
                  {z.name} — {z.feeFormatted}
                </option>
              ))}
            </select>
            {zoneName && (
              <p className="mt-1 text-xs text-gray-500">
                {config.zones.find((z) => z.name === zoneName)?.areasNote}
              </p>
            )}
            <FieldError msg={fieldErrors?.deliveryZone} />
          </div>
        )}

        {/* Date */}
        <div>
          <label htmlFor="fulfillmentDate" className={t.label}>
            {method === 'pickup' ? 'Pickup date' : 'Delivery date'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <select
            id="fulfillmentDate"
            name="fulfillmentDate"
            defaultValue={config.dates[0]?.iso}
            className={t.input}
          >
            {config.dates.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.label}
              </option>
            ))}
          </select>
          <FieldError msg={fieldErrors?.fulfillmentDate} />
        </div>

        {/* Time window */}
        <div>
          <span className={t.label}>
            Time window <span className="text-red-500">*</span>
          </span>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Time window">
            {windows.map((label, i) => (
              <label key={label} className={t.chip}>
                <input
                  type="radio"
                  name="fulfillmentWindow"
                  value={label}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <FieldError msg={fieldErrors?.fulfillmentWindow} />
        </div>
      </div>
    </fieldset>
  )
}
