/**
 * Scope Payload's client-hint headers to the admin.
 *
 * `withPayload()` appends a `/:path*` header rule carrying
 * `Accept-CH` / `Critical-CH: Sec-CH-Prefers-Color-Scheme` (plus `Vary`) so the
 * admin can server-render its dark theme without a flash. On every OTHER page
 * that `Critical-CH` is pure cost: a browser that has not yet cached the hint
 * for the origin (every first-time visitor, and every Lighthouse run) aborts
 * the first navigation and re-issues it with the hint. DevTools shows that
 * retry as a 307 to the same URL; on a throttled mobile profile it was 600 ms
 * before a single byte of the homepage arrived, and it dragged FCP and LCP with
 * it. The storefront and marketing pages never read the hint, so they should
 * not demand it.
 *
 * This rewrites that one rule's `source` to `/admin/:path*` and leaves every
 * other rule (ours and Payload's) untouched. It deliberately matches on the
 * header key rather than array position so a future Payload release that
 * reorders its rules keeps working.
 */

type HeaderRule = {
  source: string
  headers: { key: string; value: string }[]
  [key: string]: unknown
}

export const CLIENT_HINT_KEY = 'critical-ch'
export const ADMIN_SOURCE = '/admin/:path*'

export function scopeClientHintsToAdmin<T extends HeaderRule>(rules: T[]): T[] {
  return rules.map((rule) => {
    const demandsHint = rule.headers.some((h) => h.key.toLowerCase() === CLIENT_HINT_KEY)
    if (!demandsHint || rule.source === ADMIN_SOURCE) return rule
    return { ...rule, source: ADMIN_SOURCE }
  })
}
