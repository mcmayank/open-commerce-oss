// @vitest-environment jsdom
/**
 * The checkout order summary must show the shopper the number they are about to
 * be charged.
 *
 * It did not. The summary Total was the bare subtotal — the page said so in a
 * comment — while `startCheckout` charged subtotal + VAT. A cart of one 2800
 * item plus a 10000 gift card on a 5%-exclusive store showed AED 128.00 at
 * checkout and produced an AED 129.40 order. Same order, two numbers.
 *
 * These tests pin the display, not the arithmetic: the arithmetic is
 * `taxableBaseOf` + `orderTax`, the order path's own functions, and is guarded
 * by `src/lib/orders.giftcard-tax.test.ts` and `src/lib/tax.test.ts`. What is
 * guarded here is that the summary actually RUNS them, with the gift-card lines
 * excluded and `taxToAdd` (not `taxAmount`) driving the Total.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import CheckoutForm from './CheckoutForm'
import type { FulfillmentUIConfig } from './FulfillmentPicker'
import type { TaxConfig } from '@/lib/tax'

afterEach(() => {
  cleanup()
})

/** The action is only ever invoked on submit; these tests never submit. */
const noopAction = (async () => null) as never

/** Goods 2800 + a 10000 gift card — the cart from the browser repro. */
const MIXED_CART = [
  { key: 'goods', label: 'Sourdough loaf × 1', amount: 'AED 28.00', amountMinor: 2800, isGiftCard: false },
  { key: 'gc', label: 'Gift card × 1', amount: 'AED 100.00', amountMinor: 10000, isGiftCard: true },
]
const MIXED_SUBTOTAL = 12800

const EXCLUSIVE_5: TaxConfig = {
  enabled: true,
  rate: 5,
  pricesIncludeTax: false,
  registrationNumber: '100123456700003',
}
const INCLUSIVE_5: TaxConfig = { ...EXCLUSIVE_5, pricesIncludeTax: true }

function renderForm(props: Partial<React.ComponentProps<typeof CheckoutForm>> = {}) {
  return render(
    <CheckoutForm
      action={noopAction}
      summaryLines={MIXED_CART}
      subtotalFormatted="AED 128.00"
      totalFormatted="AED 128.00"
      currency="AED"
      subtotalMinor={MIXED_SUBTOTAL}
      {...props}
    />,
  )
}

/**
 * The amount rendered beside a summary row label.
 *
 * `Intl.NumberFormat` separates the currency code with U+00A0, so the
 * non-breaking space is normalised away to keep the expectations readable.
 */
function amountFor(labelPattern: RegExp): string {
  const label = screen.getByText(labelPattern)
  const row = label.parentElement
  if (!row) throw new Error(`no row for ${labelPattern}`)
  const amount = row.lastElementChild
  if (!amount || amount === label) throw new Error(`no amount cell for ${labelPattern}`)
  return (amount.textContent ?? '').replace(/ /g, ' ')
}

describe('CheckoutForm order summary — tax', () => {
  it('shows exclusive VAT and a Total that matches what the order will charge', () => {
    renderForm({ tax: EXCLUSIVE_5 })

    // Presence guard: the summary really rendered, so the assertions below are
    // about content and not about an empty tree.
    expect(screen.getByText('Order Summary')).toBeTruthy()
    expect(amountFor(/^Subtotal$/)).toBe('AED 128.00')

    // VAT on the 2800 of goods only: 2800 × 5% = 140.
    expect(amountFor(/^VAT \(5%\)$/)).toBe('AED 1.40')
    // 12800 + 140 = 12940 — the number the order actually came out at.
    expect(amountFor(/^Total$/)).toBe('AED 129.40')
  })

  it('excludes the gift card from the taxable base', () => {
    renderForm({ tax: EXCLUSIVE_5 })

    // Taxing the whole 12800 subtotal would give 640 and a Total of 13440.
    // Selling a gift card is taking a deposit, not making a taxable supply.
    expect(amountFor(/^VAT \(5%\)$/)).not.toBe('AED 6.40')
    expect(amountFor(/^Total$/)).not.toBe('AED 134.40')
    expect(amountFor(/^VAT \(5%\)$/)).toBe('AED 1.40')
  })

  it('presents inclusive VAT as included and does not move the Total', () => {
    renderForm({ tax: INCLUSIVE_5 })

    // Extraction, not addition: 2800 × 5 / 105 = 133 (rounded half up).
    expect(amountFor(/^Includes VAT \(5%\)$/)).toBe('AED 1.33')
    // The listed prices already contain it, so the Total is still the subtotal.
    expect(amountFor(/^Total$/)).toBe('AED 128.00')
    // And it must NOT be rendered as an added line.
    expect(screen.queryByText(/^VAT \(5%\)$/)).toBeNull()
  })

  it('renders no tax row and leaves the Total alone when tax is disabled', () => {
    renderForm({ tax: { enabled: false, rate: 5, pricesIncludeTax: false } })

    expect(screen.queryByText(/VAT/)).toBeNull()
    expect(amountFor(/^Total$/)).toBe('AED 128.00')
  })

  it('renders no tax row when the store has no tax settings at all', () => {
    renderForm({ tax: null })

    expect(screen.queryByText(/VAT/)).toBeNull()
    expect(amountFor(/^Total$/)).toBe('AED 128.00')
  })
})

const FULFILLMENT: FulfillmentUIConfig = {
  pickupEnabled: true,
  deliveryEnabled: true,
  dates: [{ iso: '2026-08-12', label: 'Wed 12 Aug' }],
  pickupWindows: ['10:00 – 12:00'],
  deliveryWindows: ['14:00 – 16:00'],
  zones: [{ name: 'Jumeirah', feeMinor: 1500, feeFormatted: 'AED 15.00' }],
}

/** Switch to delivery and pick the one zone, so its fee is live. */
function selectDeliveryZone() {
  fireEvent.click(screen.getByText('Local delivery'))
  const select = screen.getByLabelText(/area/i) as HTMLSelectElement
  fireEvent.change(select, { target: { value: 'Jumeirah' } })
}

describe('CheckoutForm order summary — delivery fee', () => {
  it('still folds the delivery fee into the Total when tax is off', () => {
    renderForm({ fulfillment: FULFILLMENT })
    selectDeliveryZone()

    expect(amountFor(/^Delivery — Jumeirah$/)).toBe('AED 15.00')
    // 12800 + 1500, unchanged from the behaviour that already shipped.
    expect(amountFor(/^Total$/)).toBe('AED 143.00')
  })

  it('puts the delivery fee into the taxable base, as the order does', () => {
    renderForm({ fulfillment: FULFILLMENT, tax: EXCLUSIVE_5 })
    selectDeliveryZone()

    // `taxableBaseOf` adds shipping: (2800 + 1500) × 5% = 215.
    expect(amountFor(/^VAT \(5%\)$/)).toBe('AED 2.15')
    // 12800 + 1500 + 215 = 14515.
    expect(amountFor(/^Total$/)).toBe('AED 145.15')
  })
})
