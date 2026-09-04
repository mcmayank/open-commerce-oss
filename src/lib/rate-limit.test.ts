import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, __resetRateLimits } from './rate-limit'

beforeEach(() => __resetRateLimits())

describe('rateLimit', () => {
  it('allows up to the limit within a window, then blocks', () => {
    const opts = { limit: 3, windowMs: 60_000, now: 1000 }
    expect(rateLimit('k', opts).ok).toBe(true)
    expect(rateLimit('k', opts).ok).toBe(true)
    expect(rateLimit('k', opts).ok).toBe(true)
    const blocked = rateLimit('k', opts)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 0 }).ok).toBe(true)
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 500 }).ok).toBe(false)
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 1000 }).ok).toBe(true)
  })

  it('tracks keys independently', () => {
    const opts = { limit: 1, windowMs: 1000, now: 0 }
    expect(rateLimit('a', opts).ok).toBe(true)
    expect(rateLimit('b', opts).ok).toBe(true)
    expect(rateLimit('a', opts).ok).toBe(false)
  })
})
