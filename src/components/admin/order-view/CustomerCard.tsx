import React from 'react'
import type { OrderDoc } from './types'

export interface CustomerCardProps {
  order: OrderDoc
}

/**
 * Display-only sidebar card showing buyer email + shipping address.
 * Null-safe: renders without the "Ship to" block if shippingAddress is absent.
 */
export function CustomerCard({ order }: CustomerCardProps) {
  const addr = order.shippingAddress ?? null

  return (
    <div className="ov-card">
      <div className="ov-card__head">
        <h3>Customer</h3>
      </div>
      <div className="ov-card__body">
        <div className="ov-kv">
          <div className="ov-kv__key">Email</div>
          <div className="ov-kv__val">{order.email}</div>
        </div>
        {addr ? (
          <div className="ov-kv">
            <div className="ov-kv__key">Ship to</div>
            <address className="ov-addr">
              {addr.name}
              <br />
              {addr.line1}
              {addr.line2 ? (
                <>
                  <br />
                  {addr.line2}
                </>
              ) : null}
              <br />
              {addr.city}
              {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
              <br />
              {addr.country}
              {addr.phone ? ` · ${addr.phone}` : null}
            </address>
          </div>
        ) : null}
      </div>
    </div>
  )
}
