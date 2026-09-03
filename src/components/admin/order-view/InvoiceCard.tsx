'use client'

import React from 'react'
import type { OrderDoc } from './types'
import type { Invoice } from '@/payload-types'

export interface InvoiceCardProps {
  order: OrderDoc
  /**
   * Handler for Issue / Resend. Lifted to OrderDashboard so the same action
   * can be triggered from the page Header without duplicating the fetch.
   */
  onIssue: () => Promise<void>
  /** Whether the issue request is in flight. */
  busy: boolean
  /** Status message to display after the action (success or error). */
  msg: string | null
  /** When true, msg is an error; renders in error colour. */
  isError: boolean
}

/**
 * Sidebar card displaying invoice state + Issue / Resend action.
 *
 * State (busy / msg / isError) is lifted to OrderDashboard so the same
 * handler can be wired to the Header "Resend invoice" / "Issue invoice"
 * button without duplicating the fetch call.
 *
 * - When `order.invoicePdf` is a populated Invoice object: shows PDF chip,
 *   invoice number, issued/sent dates, and a Download PDF link.
 * - When no invoice exists: shows "Not issued".
 * - Renders an Issue & email / Resend primary button that calls `onIssue`.
 */
export function InvoiceCard({ order, onIssue, busy, msg, isError }: InvoiceCardProps) {
  const hasInvoice = Boolean(order.invoiceNumber)

  // invoicePdf may be an ID (number) or a populated Invoice object. It points at
  // the `invoices` collection, not `media`.
  const pdfInvoice =
    order.invoicePdf !== null &&
    order.invoicePdf !== undefined &&
    typeof order.invoicePdf === 'object'
      ? (order.invoicePdf as Invoice)
      : null
  const pdfUrl = pdfInvoice?.url ?? null

  const issuedDate = order.invoiceIssuedAt
    ? new Date(order.invoiceIssuedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  const sentDate = order.invoiceSentAt
    ? new Date(order.invoiceSentAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  const datesMeta = [
    issuedDate ? `Issued ${issuedDate}` : null,
    sentDate ? `Sent ${sentDate}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const btnLabel = busy ? 'Sending…' : hasInvoice ? 'Resend invoice' : 'Issue & email invoice'

  return (
    <div className="ov-card">
      <div className="ov-card__head">
        <h3>Invoice</h3>
      </div>
      <div className="ov-card__body">
        {hasInvoice ? (
          <>
            <div className="ov-inv-row">
              <div className="ov-inv-pdf">PDF</div>
              <div className="ov-inv-info">
                <div className="ov-inv-info__title">{order.invoiceNumber}</div>
                {datesMeta ? <div className="ov-inv-info__meta">{datesMeta}</div> : null}
              </div>
            </div>
            <div className="ov-inv-links">
              {pdfUrl ? (
                <a
                  className="ov-link"
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download PDF
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <p className="ov-inv-empty">Not issued</p>
        )}

        <button
          type="button"
          className="ov-btn ov-btn--primary ov-inv-action"
          onClick={() => void onIssue()}
          disabled={busy}
        >
          {btnLabel}
        </button>

        {msg ? (
          <p className={`ov-inv-msg${isError ? ' ov-inv-msg--err' : ''}`}>{msg}</p>
        ) : null}
      </div>
    </div>
  )
}
