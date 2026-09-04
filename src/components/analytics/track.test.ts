import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendGAEvent = vi.fn()
vi.mock('@next/third-parties/google', () => ({ sendGAEvent: (...a: unknown[]) => sendGAEvent(...a) }))

import { trackEvent } from './track'

describe('trackEvent', () => {
  beforeEach(() => {
    sendGAEvent.mockClear()
    delete (globalThis as { dataLayer?: unknown[] }).dataLayer
  })

  it('no-ops when GA is not loaded (no dataLayer)', () => {
    const result = trackEvent('add_to_cart', { value: 10 })
    expect(sendGAEvent).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('sends the event when dataLayer exists', () => {
    ;(globalThis as { dataLayer?: unknown[] }).dataLayer = []
    const result = trackEvent('purchase', { value: 42, currency: 'AED' })
    expect(sendGAEvent).toHaveBeenCalledWith('event', 'purchase', { value: 42, currency: 'AED' })
    expect(result).toBe(true)
  })
})
