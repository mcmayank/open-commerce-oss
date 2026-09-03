'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DocumentViewClientProps } from 'payload'
import { useDocumentInfo, Form, OperationProvider } from '@payloadcms/ui'
import type { Invoice } from '@/payload-types'
import type { OrderDoc } from './types'

import { Header } from './Header'
import { StatCards } from './StatCards'
import { ItemsTable } from './ItemsTable'
import { Timeline } from './Timeline'
import { FulfillmentCard } from './FulfillmentCard'
import { InvoiceCard } from './InvoiceCard'
import { RefundCard, type RefundOutcome } from './RefundCard'
import { CustomerCard } from './CustomerCard'

import './order-view.css'

/**
 * Custom default edit view for the Orders collection.
 *
 * Composes the full order dashboard: Header → StatCards → two-column grid
 * (main: ItemsTable + Timeline; sidebar: FulfillmentCard + InvoiceCard +
 * RefundCard + CustomerCard).
 *
 * Invoice-issue state is lifted here so the Header action button and the
 * InvoiceCard sidebar button both trigger the same handler without duplicating
 * the fetch. After a successful Save OR a successful invoice issue, the page
 * refreshes via router.refresh() so the dashboard reflects the new state.
 *
 * API-confirmed facts (Payload 3.85 / @payloadcms/ui):
 *  - DocumentViewClientProps from 'payload' — includes formState: FormState
 *  - useDocumentInfo().data — current document data
 *  - useDocumentInfo().id   — document id (number | string | undefined)
 *  - useDocumentInfo().action — computed Payload API URL for PATCH submission
 *  - Form.onSuccess — called after a successful form submission
 *  - SaveButton — requires Form + OperationProvider context
 *
 * View registered as: admin.components.views.edit.default.Component
 */
export default function OrderDashboard(props: DocumentViewClientProps) {
  const router = useRouter()
  const { data, action, id } = useDocumentInfo()
  const order = (data ?? {}) as OrderDoc

  // ── Lifted invoice-issue state ────────────────────────────────────────
  // Shared between the Header action button and InvoiceCard sidebar button.
  const [invBusy, setInvBusy] = useState(false)
  const [invMsg, setInvMsg] = useState<string | null>(null)
  const [invError, setInvError] = useState(false)

  const handleIssue = async () => {
    const docId = id ?? order.id
    if (!docId) return
    setInvBusy(true)
    setInvMsg(null)
    setInvError(false)
    try {
      const res = await fetch(`/api/orders/${docId}/invoice`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await res.json()) as { invoiceNumber?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to issue invoice')
      setInvMsg(
        body.invoiceNumber
          ? `Invoice ${body.invoiceNumber} emailed to the customer.`
          : 'Invoice issued and emailed to the customer.',
      )
      // Refresh the page data so the dashboard reflects the new invoice state
      router.refresh()
    } catch (e) {
      setInvError(true)
      setInvMsg(e instanceof Error ? e.message : 'Failed to issue invoice')
    } finally {
      setInvBusy(false)
    }
  }

  // ── Refund ────────────────────────────────────────────────────────────
  // Returns the server's reason on refusal, or a success outcome that may
  // carry a `notice`. Every rule that decides whether the money may move lives
  // server-side in `decideRefund`; this only carries the answer back to the
  // card. The notice is currently the gift-card one: refunding an order that
  // MINTED cards does not void them, and the merchant has to be told.
  const handleRefund = async (amountMinor: number): Promise<RefundOutcome> => {
    const docId = id ?? order.id
    if (!docId) return { error: 'This order has not been saved yet.' }
    try {
      const res = await fetch(`/api/orders/${docId}/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor }),
      })
      const body = (await res.json()) as { error?: string; giftCardNotice?: string }
      if (!res.ok) return { error: body.error ?? 'The refund could not be completed.' }
      router.refresh()
      return { notice: body.giftCardNotice ?? null }
    } catch {
      return { error: 'The refund could not be completed.' }
    }
  }

  // ── Download handler ─────────────────────────────────────────────────
  // invoicePdf may be an ID (number) or a populated Invoice object. It points at
  // the `invoices` collection, not `media`.
  const pdfInvoice =
    order.invoicePdf !== null &&
    order.invoicePdf !== undefined &&
    typeof order.invoicePdf === 'object'
      ? (order.invoicePdf as Invoice)
      : null
  const pdfUrl = pdfInvoice?.url ?? null
  const handleDownload = pdfUrl ? () => { window.open(pdfUrl, '_blank') } : undefined

  return (
    <OperationProvider operation="update">
      <Form
        action={action}
        initialState={props.formState}
        isDocumentForm
        method="PATCH"
        onSuccess={() => router.refresh()}
      >
        <div className="ov-root">
          {/* ── Page header: order title, status badge, action buttons ── */}
          <Header
            order={order}
            onDownloadInvoice={handleDownload}
            onIssueResendInvoice={handleIssue}
          />

          {/* ── Four stat cards ─────────────────────────────────────── */}
          <StatCards order={order} />

          {/* ── Main two-column grid ─────────────────────────────────── */}
          <div className="ov-grid">
            {/* Main column: items table (with totals) + timeline */}
            <div className="ov-main">
              <ItemsTable order={order} />
              <Timeline order={order} />
            </div>

            {/* Sidebar: fulfillment (editable) + invoice + customer */}
            <div className="ov-side">
              <FulfillmentCard />
              <InvoiceCard
                order={order}
                onIssue={handleIssue}
                busy={invBusy}
                msg={invMsg}
                isError={invError}
              />
              {/* Refunds only make sense once money was actually captured. */}
              {order.paidAt ? <RefundCard order={order} onRefund={handleRefund} /> : null}
              <CustomerCard order={order} />
            </div>
          </div>
        </div>
      </Form>
    </OperationProvider>
  )
}
