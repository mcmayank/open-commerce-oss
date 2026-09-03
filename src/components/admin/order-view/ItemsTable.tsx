import React from 'react'
import { formatMoney } from '@/lib/money'
import type { OrderDoc } from './types'

export interface ItemsTableProps {
  order: OrderDoc
}

/**
 * Items card for the order dashboard.
 *
 * Renders:
 *  - A table with one row per line item:
 *      thumbnail (placeholder when no media) | title + variant | qty | unit price | line total
 *  - A totals block (subtotal, discount [with code, shown negative], shipping, tax, grand total).
 *    Zero-value discount / shipping / tax rows are omitted.
 *
 * All monetary values go through formatMoney(minorUnits, currency) — no float math.
 */
export function ItemsTable({ order }: ItemsTableProps) {
  const { currency, subtotal, discountAmount, shippingAmount, taxAmount, total, discountCode } =
    order
  const lineItems = order.lineItems ?? []

  return (
    <div className="ov-card">
      <div className="ov-card__head">
        <h3>Items</h3>
        <span className="ov-card__head-sub">
          {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Items table */}
      <div className="ov-items-wrap">
        <table className="ov-items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="ov-r">Qty</th>
              <th className="ov-r">Unit</th>
              <th className="ov-r">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={item.id ?? `${item.productId}-${idx}`}>
                <td>
                  <div className="ov-item">
                    {/* Thumbnail — always placeholder; media not stored on line items */}
                    <div className="ov-thumb ov-thumb--placeholder" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="5.5" cy="5.5" r="1.5" />
                        <path d="M1 11l4-3 3 3 2-2 4 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    <div>
                      <div className="ov-item__title">{item.title}</div>
                      {item.variantTitle && (
                        <div className="ov-item__meta">Variant: {item.variantTitle}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="ov-r">{item.qty}</td>
                <td className="ov-r">{formatMoney(item.unitPrice, currency)}</td>
                <td className="ov-r">{formatMoney(item.lineTotal, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals block */}
      <div className="ov-totals">
        <div className="ov-totals__row">
          <span className="ov-totals__label">Subtotal</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>

        {discountAmount !== 0 && (
          <div className="ov-totals__row">
            <span className="ov-totals__label">
              Discount{discountCode ? ` (${discountCode})` : ''}
            </span>
            <span className="ov-totals__neg">−{formatMoney(discountAmount, currency)}</span>
          </div>
        )}

        {shippingAmount !== 0 && (
          <div className="ov-totals__row">
            <span className="ov-totals__label">Shipping</span>
            <span>{formatMoney(shippingAmount, currency)}</span>
          </div>
        )}

        {taxAmount !== 0 && (
          <div className="ov-totals__row">
            <span className="ov-totals__label">Tax</span>
            <span>{formatMoney(taxAmount, currency)}</span>
          </div>
        )}

        <div className="ov-totals__row ov-totals__row--grand">
          <span>Total</span>
          <span>{formatMoney(total, currency)}</span>
        </div>
      </div>
    </div>
  )
}
