'use client'

import React, { useActionState, useState } from 'react'
import { formatMoney } from '@/lib/money'
import { taxableBaseOf } from '@/lib/orders-math'
import { orderTax, type TaxConfig } from '@/lib/tax'
import type { startCheckout, CheckoutState } from './actions'
import FulfillmentPicker, {
  type FulfillmentMethodValue,
  type FulfillmentUIConfig,
} from './FulfillmentPicker'
import PaymentRedirector from './PaymentRedirector'

interface SummaryLine {
  key: string
  label: string
  amount: string
  /** Line total in minor units — feeds the taxable base. */
  amountMinor?: number
  /**
   * Carried down from the page, which already knows it from
   * `product.issuesGiftCard`. Never recomputed here: a second copy of the
   * gift-card rule is exactly how the summary and the order drift apart.
   */
  isGiftCard?: boolean
}

interface InitialAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

interface CheckoutFormProps {
  action: typeof startCheckout
  summaryLines: SummaryLine[]
  subtotalFormatted: string
  totalFormatted: string
  currency: string
  /** Pre-filled from a logged-in customer session (optional — guest checkout unchanged). */
  initialEmail?: string
  initialName?: string
  initialAddress?: InitialAddress
  /** Subtotal in minor units — needed to compute the live total with a delivery fee. */
  subtotalMinor?: number
  /** Pickup/delivery scheduling config; when present the picker is rendered. */
  fulfillment?: FulfillmentUIConfig
  /** True when the cart contains at least one gift-card product — shows the recipient fields. */
  hasGiftCardItem?: boolean
  /**
   * The store's tax settings, snapshotted by the page in the same shape
   * `startCheckout` hands to `buildOrderFromCart`. Null/undefined ⇒ no tax row
   * and the total behaves exactly as it did before.
   */
  tax?: TaxConfig | null
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-sm text-red-600">{msg}</p>
}

export default function CheckoutForm({
  action,
  summaryLines,
  subtotalFormatted,
  totalFormatted,
  currency,
  initialEmail = '',
  initialName = '',
  initialAddress,
  subtotalMinor,
  fulfillment,
  hasGiftCardItem = false,
  tax,
}: CheckoutFormProps) {
  const [state, formAction, isPending] = useActionState<CheckoutState, FormData>(action, null)

  const [method, setMethod] = useState<FulfillmentMethodValue>(
    fulfillment && !fulfillment.pickupEnabled ? 'delivery' : 'pickup',
  )
  const [zoneName, setZoneName] = useState('')

  const isPickup = fulfillment != null && method === 'pickup'
  const deliveryFeeMinor =
    fulfillment && method === 'delivery'
      ? (fulfillment.zones.find((z) => z.name === zoneName)?.feeMinor ?? 0)
      : 0
  // Tax, computed with the ORDER PATH'S OWN functions — `taxableBaseOf` and
  // `orderTax`, the two `buildOrderFromCart` calls. Both are pure, so the
  // summary and the order cannot disagree by construction. Reimplementing the
  // arithmetic here is the bug this replaces: the summary used to show the
  // bare subtotal while the order charged subtotal + VAT.
  //
  // Discount is deliberately absent (0). A code is unvalidated user input until
  // submit, so the client cannot know its amount without a server round trip —
  // the "Changes your total." hint under that field stays the honest signal.
  const taxableBaseMinor = taxableBaseOf(
    summaryLines.map((l) => ({ lineTotal: l.amountMinor ?? 0, isGiftCard: l.isGiftCard })),
    0,
    deliveryFeeMinor,
  )
  const orderTaxSnapshot = orderTax(taxableBaseMinor, tax)
  const showTaxRow = tax?.enabled === true
  const taxRateLabel = `${tax?.rate ?? 0}%`

  // `taxToAdd`, never `taxAmount` — mirroring `buildOrderFromCart`. In
  // inclusive mode the VAT already sits inside the line prices, so it is
  // displayed but the total must not move.
  const liveTotalFormatted =
    subtotalMinor != null
      ? formatMoney(subtotalMinor + deliveryFeeMinor + orderTaxSnapshot.taxToAdd, currency)
      : totalFormatted

  // A form-POST provider hands back a descriptor to auto-submit off-site.
  if (state?.formRedirect) {
    return <PaymentRedirector redirect={state.formRedirect} />
  }

  return (
    <form action={formAction} noValidate>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* ── Left: contact + shipping fields ── */}
        <div className="flex-1 space-y-6">
          {/* Top-level action error */}
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* Contact */}
          <fieldset className="rounded-xl border border-gray-200 bg-white p-6">
            <legend className="mb-4 text-base font-semibold text-gray-900">
              Contact information
            </legend>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={initialEmail}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="you@example.com"
                />
                <FieldError msg={state?.fieldErrors?.email} />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="emailOptIn"
                  name="emailOptIn"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)]"
                />
                <label htmlFor="emailOptIn" className="text-sm text-gray-600">
                  Email me news &amp; offers
                </label>
              </div>
            </div>
          </fieldset>

          {/* Fulfilment scheduling (when the store enables pickup/delivery) */}
          {fulfillment && (
            <FulfillmentPicker
              config={fulfillment}
              method={method}
              onMethodChange={setMethod}
              zoneName={zoneName}
              onZoneChange={setZoneName}
              fieldErrors={state?.fieldErrors}
            />
          )}

          {/* Shipping address (buyer details only, for pickup) */}
          <fieldset className="rounded-xl border border-gray-200 bg-white p-6">
            <legend className="mb-4 text-base font-semibold text-gray-900">
              {isPickup ? 'Your details' : fulfillment ? 'Delivery address' : 'Shipping address'}
            </legend>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  defaultValue={initialName}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Jane Smith"
                />
                <FieldError msg={state?.fieldErrors?.name} />
              </div>

              {!isPickup && (
              <>
              <div>
                <label htmlFor="line1" className="block text-sm font-medium text-gray-700">
                  Address line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  id="line1"
                  name="line1"
                  type="text"
                  autoComplete="address-line1"
                  required
                  defaultValue={initialAddress?.line1 ?? ''}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="123 Main St"
                />
                <FieldError msg={state?.fieldErrors?.line1} />
              </div>

              <div>
                <label htmlFor="line2" className="block text-sm font-medium text-gray-700">
                  Address line 2
                </label>
                <input
                  id="line2"
                  name="line2"
                  type="text"
                  autoComplete="address-line2"
                  defaultValue={initialAddress?.line2 ?? ''}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    required
                    defaultValue={initialAddress?.city ?? ''}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="Mumbai"
                  />
                  <FieldError msg={state?.fieldErrors?.city} />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State / Province
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    defaultValue={initialAddress?.state ?? ''}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="Maharashtra"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
                    Postal code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    autoComplete="postal-code"
                    required
                    defaultValue={initialAddress?.postalCode ?? ''}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="400001"
                  />
                  <FieldError msg={state?.fieldErrors?.postalCode} />
                </div>

                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    autoComplete="country-name"
                    required
                    defaultValue={initialAddress?.country ?? ''}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="India"
                  />
                  <FieldError msg={state?.fieldErrors?.country} />
                </div>
              </div>
              </>
              )}

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone number {isPickup && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required={isPickup}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder={isPickup ? '+971 50 123 4567' : '+91 98765 43210 (optional)'}
                />
                <FieldError msg={state?.fieldErrors?.phone} />
              </div>
            </div>
          </fieldset>

          {/* Gift card recipient — one set of details per order, not per card.
              Quantity 3 of a gift-card product mints three cards that all
              carry this single set of details (design spec). Recipient email
              is required here, at checkout, because with no data written
              anywhere on the order, sendGiftCardEmailForOrder has nothing to
              send to and the codes are minted and discarded. */}
          {hasGiftCardItem && (
            <fieldset className="rounded-xl border border-gray-200 bg-white p-6">
              <legend className="mb-4 text-base font-semibold text-gray-900">
                Gift card recipient
              </legend>
              <p className="mb-4 text-sm text-gray-500">
                Your cart includes a gift card. Tell us who to send it to — every card in
                this order will carry these details.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="giftCardRecipientName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Recipient name
                  </label>
                  <input
                    id="giftCardRecipientName"
                    name="giftCardRecipientName"
                    type="text"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="Priya Sharma"
                  />
                  <FieldError msg={state?.fieldErrors?.giftCardRecipientName} />
                </div>

                <div>
                  <label
                    htmlFor="giftCardRecipientEmail"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Recipient email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="giftCardRecipientEmail"
                    name="giftCardRecipientEmail"
                    type="email"
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="recipient@example.com"
                  />
                  <FieldError msg={state?.fieldErrors?.giftCardRecipientEmail} />
                </div>

                <div>
                  <label
                    htmlFor="giftCardMessage"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Message (optional)
                  </label>
                  <textarea
                    id="giftCardMessage"
                    name="giftCardMessage"
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="Happy birthday!"
                  />
                </div>
              </div>
            </fieldset>
          )}

          {/* Discount code */}
          <fieldset className="rounded-xl border border-gray-200 bg-white p-6">
            <legend className="mb-4 text-base font-semibold text-gray-900">
              Discount code
            </legend>

            <div>
              <label htmlFor="discountCode" className="block text-sm font-medium text-gray-700">
                Promo / discount code
              </label>
              <input
                id="discountCode"
                name="discountCode"
                type="text"
                autoCapitalize="characters"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 uppercase focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="SAVE10"
              />
              <FieldError msg={state?.fieldErrors?.discountCode} />
              <p className="mt-1 text-xs text-gray-400">Changes your total.</p>
            </div>
          </fieldset>

          {/* Gift card code — distinct from a discount: it changes what you pay,
              not the total. The action already reads `giftCardCode`, reserves
              the balance, and applies it as tender (Task 6/7); this is only
              the input. */}
          <fieldset className="rounded-xl border border-gray-200 bg-white p-6">
            <legend className="mb-4 text-base font-semibold text-gray-900">
              Gift card
            </legend>

            <div>
              <label htmlFor="giftCardCode" className="block text-sm font-medium text-gray-700">
                Gift card code
              </label>
              <input
                id="giftCardCode"
                name="giftCardCode"
                type="text"
                autoCapitalize="characters"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 uppercase focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="GIFT-XXXX-XXXX"
              />
              <FieldError msg={state?.fieldErrors?.giftCardCode} />
              <p className="mt-1 text-xs text-gray-400">
                Changes what you pay — the total stays the same.
              </p>
            </div>
          </fieldset>
        </div>

        {/* ── Right: order summary + submit ── */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Order Summary</h2>

            <div className="space-y-2 text-sm">
              {summaryLines.map((line) => (
                <div key={line.key} className="flex justify-between text-gray-600">
                  <span className="mr-2 truncate">{line.label}</span>
                  <span className="shrink-0">{line.amount}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-gray-200 pt-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{subtotalFormatted}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                {fulfillment ? (
                  method === 'delivery' ? (
                    <>
                      <span>Delivery{zoneName ? ` — ${zoneName}` : ''}</span>
                      <span>
                        {zoneName ? formatMoney(deliveryFeeMinor, currency) : 'Select area'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Pickup</span>
                      <span>Free</span>
                    </>
                  )
                ) : (
                  <>
                    <span>Shipping</span>
                    <span>Free</span>
                  </>
                )}
              </div>

              {/* VAT. Exclusive mode adds it, so it belongs in this list of
                  things stacked on top of the subtotal. Inclusive mode does
                  not — that row lives under the Total instead. */}
              {showTaxRow && !tax?.pricesIncludeTax && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>VAT ({taxRateLabel})</span>
                  <span>{formatMoney(orderTaxSnapshot.taxAmount, currency)}</span>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-gray-200 pt-3 flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{liveTotalFormatted}</span>
            </div>

            {/* Inclusive VAT is already inside the prices above. Shown as a
                breakdown of the Total, never as an addition to it. */}
            {showTaxRow && tax?.pricesIncludeTax && (
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>Includes VAT ({taxRateLabel})</span>
                <span>{formatMoney(orderTaxSnapshot.taxAmount, currency)}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-6 w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'var(--color-primary)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              {isPending ? 'Processing…' : 'Place order & pay'}
            </button>

            <p className="mt-3 text-center text-xs text-gray-400">
              You will be redirected to our payment provider to complete your purchase securely.
            </p>
          </div>
        </div>
      </div>
    </form>
  )
}
