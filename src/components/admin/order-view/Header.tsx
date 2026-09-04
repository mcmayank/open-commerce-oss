import React from 'react'
import { statusMeta } from './derive'
import type { OrderDoc } from './types'

export interface HeaderProps {
  order: OrderDoc
  /** Called when the user clicks "Download invoice". Wired in Task 4/5. */
  onDownloadInvoice?: () => void | Promise<void>
  /** Called when the user clicks "Issue / Resend invoice". Wired in Task 4/5. */
  onIssueResendInvoice?: () => void | Promise<void>
}

/**
 * Display-only header row for the order dashboard.
 *
 * Renders:
 *  - "Order <orderNumber>" + status badge (tone via statusMeta)
 *  - Placed date · store name sub-line
 *  - Download invoice + Issue/Resend invoice action buttons
 *
 * Click handlers are accepted as optional props so Task 4/5 can wire them up.
 * Buttons render in a disabled-looking state when no handler is supplied.
 */
export function Header({ order, onDownloadInvoice, onIssueResendInvoice }: HeaderProps) {
  const meta = statusMeta(order.status)

  // Resolve tenant name when the relation is populated
  const rel = (order as { tenant?: unknown }).tenant
  const storeName = typeof rel === 'object' && rel !== null ? ((rel as { name?: string }).name ?? null) : null

  const placedAt = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const hasInvoice = Boolean(order.invoiceNumber)
  const issueLabel = hasInvoice ? 'Resend invoice' : 'Issue invoice'

  return (
    <div className="ov-header">
      <div className="ov-header__left">
        <h1 className="ov-header__title">
          Order{' '}
          {order.orderNumber ? <span className="ov-mono">{order.orderNumber}</span> : null}
          <span className={`ov-badge ov-badge--${meta.tone} ov-badge--dot`}>{meta.label}</span>
        </h1>
        <div className="ov-header__sub">
          {placedAt && <span>Placed {placedAt}</span>}
          {storeName && <span>{storeName}</span>}
        </div>
      </div>

      <div className="ov-header__actions">
        <button
          type="button"
          className="ov-btn"
          onClick={onDownloadInvoice}
          disabled={!hasInvoice || !onDownloadInvoice}
          aria-label="Download invoice PDF"
        >
          ↓ Download invoice
        </button>
        <button
          type="button"
          className="ov-btn ov-btn--primary"
          onClick={onIssueResendInvoice}
          disabled={!onIssueResendInvoice}
          aria-label={issueLabel}
        >
          ✦ {issueLabel}
        </button>
      </div>
    </div>
  )
}
