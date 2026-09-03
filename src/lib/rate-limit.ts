/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Used to throttle the payment connection-test endpoint. This is best-effort and
 * per-instance (not shared across serverless instances) — adequate for guarding
 * an authenticated, non-destructive admin action, not for security-critical
 * limits. Documented as a known limitation.
 */
interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export interface RateLimitOptions {
  limit: number
  windowMs: number
  /** Injectable clock for testing; defaults to Date.now(). */
  now?: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = opts.now ?? Date.now()
  const existing = windows.get(key)

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.limit - 1, retryAfterMs: 0 }
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now }
  }

  existing.count += 1
  return { ok: true, remaining: opts.limit - existing.count, retryAfterMs: 0 }
}

/** Test helper — clear all windows. */
export function __resetRateLimits(): void {
  windows.clear()
}
