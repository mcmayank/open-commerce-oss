'use client'

import React from 'react'
import { useField, SaveButton } from '@payloadcms/ui'

const STATUS_OPTIONS: { label: string; value: string }[] = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
].map((v) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}))

/**
 * Editable fulfillment controls bound to the Payload form (status + trackingNumber).
 *
 * Uses useField() to read/write the form context, but renders native <select>
 * and <input> so each label's htmlFor can be properly tied to its control's id,
 * satisfying a11y requirements without fighting Payload's react-select wrapper.
 *
 * SaveButton is included here because FulfillmentCard is the only editable surface
 * in the order dashboard; it must live inside the Form context supplied by
 * OrderDashboard.
 */
export function FulfillmentCard() {
  const status = useField<string>({ path: 'status' })
  const tracking = useField<string>({ path: 'trackingNumber' })
  const ffMethod = useField<string>({ path: 'fulfillment.method' })
  const ffDate = useField<string>({ path: 'fulfillment.date' })
  const ffWindow = useField<string>({ path: 'fulfillment.windowLabel' })
  const ffZone = useField<string>({ path: 'fulfillment.zoneName' })

  const scheduled =
    ffMethod.value && ffMethod.value !== 'shipping'
      ? [
          ffMethod.value === 'pickup' ? 'Pickup' : 'Local delivery',
          ffDate.value
            ? new Date(ffDate.value).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })
            : null,
          ffWindow.value || null,
          ffZone.value ? `(${ffZone.value})` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    <div className="ov-card">
      <div className="ov-card__head">
        <h3>Fulfillment</h3>
        <span className="ov-editable">Editable</span>
      </div>
      <div className="ov-card__body">
        {scheduled && (
          <div className="ov-field">
            <span className="ov-field__label">Scheduled</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{scheduled}</p>
          </div>
        )}
        <div className="ov-field">
          <label htmlFor="ov-ff-status" className="ov-field__label">
            Status
          </label>
          <select
            id="ov-ff-status"
            className="ov-native-select"
            value={status.value ?? ''}
            onChange={(e) => status.setValue(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ov-field">
          <label htmlFor="ov-ff-tracking" className="ov-field__label">
            Tracking number
          </label>
          <input
            id="ov-ff-tracking"
            type="text"
            className="ov-native-input"
            value={tracking.value ?? ''}
            onChange={(e) => tracking.setValue(e.target.value)}
            placeholder="Add carrier tracking…"
          />
        </div>

        <div className="ov-save-btn-wrap">
          <SaveButton />
        </div>
      </div>
    </div>
  )
}
