import React from 'react'
import { itemCount, statusMeta } from './derive'
import { formatMoney } from '@/lib/money'
import type { OrderDoc } from './types'

export interface StatCardsProps {
  order: OrderDoc
}

/**
 * Four stat-card summary bar displayed beneath the order header.
 *
 * Cards:
 *  1. Order total  — formatted total, item count, currency
 *  2. Payment      — paid/unpaid · provider; providerRef (truncated) · paidAt date
 *  3. Fulfillment  — status; tracking number or "No tracking yet"
 *  4. Invoice      — invoiceNumber or "Not issued"; issued date or "—"
 */
export function StatCards({ order }: StatCardsProps) {
  const count = itemCount(order.lineItems)

  // ── Payment card ──────────────────────────────────────────
  const isPaid = ['paid', 'shipped', 'delivered'].includes(order.status)
  const isRefunded = order.status === 'refunded'
  const paymentStatus = isRefunded ? 'Refunded' : isPaid ? 'Paid' : 'Unpaid'
  const paymentLine = order.paymentProvider
    ? `${paymentStatus} · ${order.paymentProvider}`
    : paymentStatus

  const providerRefDisplay = order.providerRef
    ? order.providerRef.length > 14
      ? `${order.providerRef.slice(0, 12)}…`
      : order.providerRef
    : null

  const paidDateDisplay = order.paidAt
    ? new Date(order.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const paymentMeta = [providerRefDisplay, paidDateDisplay].filter(Boolean).join(' · ')

  // ── Fulfillment card ──────────────────────────────────────
  const fulfillmentStatus = statusMeta(order.status).label
  const trackingMeta = order.trackingNumber ?? 'No tracking yet'

  // ── Invoice card ──────────────────────────────────────────
  const invoiceNum = order.invoiceNumber ?? 'Not issued'
  const invoiceDate = order.invoiceIssuedAt
    ? new Date(order.invoiceIssuedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null
  const invoiceMeta = invoiceDate ? `Issued ${invoiceDate}` : '—'

  return (
    <div className="ov-stat-grid">
      {/* 1. Order total */}
      <div className="ov-stat">
        <div className="ov-stat__key">Order total</div>
        <div className="ov-stat__value">{formatMoney(order.total, order.currency)}</div>
        <div className="ov-stat__meta">
          {count} item{count !== 1 ? 's' : ''} · {order.currency}
        </div>
      </div>

      {/* 2. Payment */}
      <div className="ov-stat">
        <div className="ov-stat__key">Payment</div>
        <div className="ov-stat__value ov-stat__value--sm">{paymentLine}</div>
        {paymentMeta && <div className="ov-stat__meta">{paymentMeta}</div>}
      </div>

      {/* 3. Fulfillment */}
      <div className="ov-stat">
        <div className="ov-stat__key">Fulfillment</div>
        <div className="ov-stat__value ov-stat__value--sm">{fulfillmentStatus}</div>
        <div className="ov-stat__meta">{trackingMeta}</div>
      </div>

      {/* 4. Invoice */}
      <div className="ov-stat">
        <div className="ov-stat__key">Invoice</div>
        <div className="ov-stat__value ov-stat__value--sm">{invoiceNum}</div>
        <div className="ov-stat__meta">{invoiceMeta}</div>
      </div>
    </div>
  )
}
