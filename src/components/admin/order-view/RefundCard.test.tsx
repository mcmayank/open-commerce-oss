// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RefundCard } from './RefundCard'
import type { OrderDoc } from './types'

/**
 * This card moves real money. The properties worth pinning are the two-step
 * confirm, that what reaches the handler is integer MINOR units, and that a
 * server refusal is shown verbatim rather than swallowed.
 */

const order = (over: Partial<OrderDoc> = {}): OrderDoc =>
  ({
    id: 1,
    currency: 'AED',
    total: 10000,
    refundedAmount: 0,
    paidAt: '2026-07-20T10:00:00.000Z',
    ...over,
  }) as OrderDoc

// RTL only auto-cleans when Vitest globals are on; this repo imports its
// test helpers explicitly, so unmount by hand or renders stack up.
afterEach(cleanup)

describe('RefundCard', () => {
  it('does not show an amount field until the merchant opens the action', () => {
    render(<RefundCard order={order()} onRefund={vi.fn()} />)
    expect(screen.queryByLabelText(/amount/i)).toBeNull()
    expect(screen.getByRole('button', { name: /issue a refund/i })).toBeTruthy()
  })

  it('never calls the handler from the first click', async () => {
    const onRefund = vi.fn()
    render(<RefundCard order={order()} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /issue a refund/i }))
    expect(onRefund).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/amount/i)).toBeTruthy()
  })

  it('prefills the outstanding amount and sends it as minor units', async () => {
    const onRefund = vi.fn().mockResolvedValue({})
    render(<RefundCard order={order({ refundedAmount: 2500 })} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /refund the rest/i }))
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('75')

    fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }))
    await waitFor(() => expect(onRefund).toHaveBeenCalledWith(7500))
  })

  it('sends a typed partial amount as minor units', async () => {
    const onRefund = vi.fn().mockResolvedValue({})
    render(<RefundCard order={order()} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /issue a refund/i }))
    const input = screen.getByLabelText(/amount/i)
    fireEvent.change(input, { target: { value: '12.50' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }))

    await waitFor(() => expect(onRefund).toHaveBeenCalledWith(1250))
  })

  it('rejects an over-refund locally without troubling the gateway', async () => {
    const onRefund = vi.fn()
    render(<RefundCard order={order()} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /issue a refund/i }))
    const input = screen.getByLabelText(/amount/i)
    fireEvent.change(input, { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }))

    expect(onRefund).not.toHaveBeenCalled()
    expect(screen.getByText(/left on this order/i)).toBeTruthy()
  })

  it('shows the server’s refusal verbatim and keeps the form open', async () => {
    const onRefund = vi.fn().mockResolvedValue({ error: 'The gateway rejected the refund.' })
    render(<RefundCard order={order()} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /issue a refund/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }))

    await waitFor(() => expect(screen.getByText('The gateway rejected the refund.')).toBeTruthy())
    // Still open, so the merchant can adjust rather than start over.
    expect(screen.getByLabelText(/amount/i)).toBeTruthy()
  })

  /**
   * A refund gives the buyer their money back but does NOT void the gift cards
   * the order minted — deliberately, because the recipient may already have
   * spent them. The merchant only finds that out if this card says so, so the
   * notice surviving alongside the success message is the property that makes
   * the manual step findable.
   */
  it('shows the gift-card notice after a successful refund, alongside the success message', async () => {
    const onRefund = vi.fn().mockResolvedValue({
      notice:
        'This order issued 1 gift card (••4242). Refunding does NOT void it — it is still spendable. Void it from Gift Cards if that is what you intended.',
    })
    render(<RefundCard order={order()} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /issue a refund/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }))

    await waitFor(() => expect(screen.getByText(/refunded\./)).toBeTruthy())
    expect(screen.getByText(/does NOT void it/)).toBeTruthy()
    expect(screen.getByText(/••4242/)).toBeTruthy()
  })

  it('shows no notice when the refund carries none', async () => {
    const onRefund = vi.fn().mockResolvedValue({})
    render(<RefundCard order={order()} onRefund={onRefund} />)

    fireEvent.click(screen.getByRole('button', { name: /issue a refund/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }))

    await waitFor(() => expect(screen.getByText(/refunded\./)).toBeTruthy())
    expect(screen.queryByText(/Gift Cards/)).toBeNull()
  })

  it('offers no further refund once the order is fully refunded', () => {
    render(<RefundCard order={order({ refundedAmount: 10000 })} onRefund={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /refund/i })).toBeNull()
    expect(screen.getByText(/AED\s*100/)).toBeTruthy()
  })
})
