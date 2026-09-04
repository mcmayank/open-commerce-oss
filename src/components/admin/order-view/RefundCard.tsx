'use client'

import React, { useState } from 'react'
import { formatMoney, fromMinor } from '@/lib/money'
import type { OrderDoc } from './types'
import { parseRefundAmount } from './derive'

/**
 * What the refund handler resolves with. `error` means the server refused and
 * no money moved. `notice` is the opposite: the refund DID happen, and there
 * is something about it the merchant has to be told — today that is gift cards
 * this order minted, which a refund does not void.
 */
export type RefundOutcome = { error: string; notice?: never } | { error?: never; notice?: string | null }

export interface RefundCardProps {
  order: OrderDoc
  /**
   * Sends the refund. Resolves with `{ error }` when the server refused, or a
   * success outcome that may carry a `notice`. Lifted to OrderDashboard so the
   * page can refresh. `null` is accepted as a bare success for callers with
   * nothing to report.
   */
  onRefund: (amountMinor: number) => Promise<RefundOutcome | null>
}

/**
 * Sidebar card for refunding an order through its own gateway.
 *
 * Deliberately two-step: the collapsed state shows only what has happened, and
 * the amount field and confirm button appear after an explicit "Issue a refund".
 * A single click must never move a merchant's money.
 *
 * The card does not try to decide whether a refund is *possible* — that answer
 * lives in the payment registry, which is server-only, and in `decideRefund`.
 * The client's job is to collect an amount and show the server's reason if it
 * says no.
 */
export function RefundCard({ order, onRefund }: RefundCardProps) {
  const currency = order.currency ?? 'USD'
  const total = order.total ?? 0
  const refunded = order.refundedAmount ?? 0
  const remaining = Math.max(0, total - refunded)

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  // Survives the success message on purpose: a refund that leaves live gift
  // cards behind is a thing the merchant may still need to act on afterwards.
  const [notice, setNotice] = useState<string | null>(null)

  const start = () => {
    // Prefill with everything still outstanding — the common case is a full
    // refund, and typing the total from memory invites a typo.
    setAmount(String(fromMinor(remaining, currency)))
    setMsg(null)
    setIsError(false)
    setOpen(true)
  }

  const cancel = () => {
    setOpen(false)
    setMsg(null)
    setIsError(false)
  }

  const submit = async () => {
    const parsed = parseRefundAmount(amount, currency, remaining)
    if (!parsed.ok) {
      setIsError(true)
      setMsg(parsed.error)
      return
    }
    setBusy(true)
    setMsg(null)
    setIsError(false)
    setNotice(null)
    const outcome = await onRefund(parsed.minor)
    setBusy(false)
    if (outcome?.error) {
      setIsError(true)
      setMsg(outcome.error)
      return
    }
    setOpen(false)
    setIsError(false)
    setMsg(`${formatMoney(parsed.minor, currency)} refunded.`)
    setNotice(outcome?.notice ?? null)
  }

  const fullyRefunded = remaining === 0 && refunded > 0

  return (
    <div className="ov-card">
      <div className="ov-card__head">
        <h3>Refund</h3>
      </div>
      <div className="ov-card__body">
        {refunded > 0 ? (
          <div className="ov-refund-summary">
            <div className="ov-refund-summary__row">
              <span>Refunded</span>
              <span className="ov-mono">{formatMoney(refunded, currency)}</span>
            </div>
            <div className="ov-refund-summary__row">
              <span>Remaining</span>
              <span className="ov-mono">{formatMoney(remaining, currency)}</span>
            </div>
          </div>
        ) : (
          <p className="ov-inv-empty">Nothing refunded</p>
        )}

        {fullyRefunded ? null : open ? (
          <>
            <div className="ov-field">
              <label htmlFor="ov-refund-amount">Amount ({currency.toUpperCase()})</label>
              <input
                id="ov-refund-amount"
                className="ov-native-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </div>
            <p className="ov-refund-warn">
              This sends money back through the gateway that took the payment. It cannot be undone
              from here.
            </p>
            <div className="ov-refund-actions">
              <button type="button" className="ov-btn" onClick={cancel} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="ov-btn ov-btn--danger"
                onClick={() => void submit()}
                disabled={busy}
              >
                {busy ? 'Refunding…' : 'Confirm refund'}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="ov-btn" onClick={start}>
            {refunded > 0 ? 'Refund the rest' : 'Issue a refund'}
          </button>
        )}

        {msg ? <p className={`ov-inv-msg${isError ? ' ov-inv-msg--err' : ''}`}>{msg}</p> : null}
        {notice ? <p className="ov-refund-warn">{notice}</p> : null}
      </div>
    </div>
  )
}
