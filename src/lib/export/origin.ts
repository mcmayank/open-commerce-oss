/**
 * The absolute origin an export request arrived on, e.g. `https://sdbakery.ae`.
 *
 * Media URLs in the CSVs are root-relative Payload routes and have to be made
 * absolute or the merchant downloads dead links (see `mediaUrl` in collect.ts).
 * Derived from the same `host` header the tenant was resolved from, so a store
 * on a custom domain gets its custom domain rather than its niblr.store
 * subdomain — whichever address the merchant is actually looking at.
 *
 * `x-forwarded-proto` when the proxy sets it (Vercel always does), else https,
 * except for a local dev host which has no TLS. Matches `storeOrigin` in
 * tenant-host.ts and the same derivation in `sitemap.ts` and `robots.ts`.
 *
 * Returns '' when there is no Host header. That is not reachable over HTTP/1.1,
 * where Host is mandatory, but the single-store build resolves its store
 * without consulting the host at all, so a null host can still reach a
 * successful export. An empty origin leaves media URLs relative —
 * the pre-existing behaviour — which is a worse link but an honest one, rather
 * than shipping `https://null/api/media/...` in every image cell.
 *
 * Lives here rather than in the route because a Next.js route module may only
 * export the handlers and its config keys; a named helper there is a type error.
 */
export function requestOrigin(headers: Headers, host: string | null): string {
  if (!host) return ''
  const forwarded = headers.get('x-forwarded-proto')
  const isLocal =
    host.startsWith('localhost') || host.startsWith('127.') || host.includes('lvh.me')
  const proto = forwarded ?? (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}
