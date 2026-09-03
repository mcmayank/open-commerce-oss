import { NextRequest, NextResponse } from 'next/server'
import { buildCsp, CSP_RESPONSE_HEADER } from '@/lib/csp'

/**
 * Per-request nonce + CSP, applied identically to every proxy branch that
 * returns a response. Forwarded two ways on the REQUEST headers:
 *
 * - `x-nonce`, read by StoreTheme/StoreCustomCss (and AnalyticsScripts, for
 *   the reason below) via headers() to nonce the tags they render.
 * - `Content-Security-Policy`, so Next's own app-render can read the nonce
 *   back out (getScriptNonceFromHeader) and apply it to the framework's OWN
 *   server-emitted scripts (the RSC flight-data `self.__next_f.push(...)`
 *   tags, the hydration bootstrap). Verified in a real browser — this does
 *   NOT extend to next/script's client-inserted `afterInteractive` scripts
 *   (what GoogleAnalytics/GoogleTagManager/PixelScripts all use): under App
 *   Router, the client-side HeadManagerContext.Provider is seeded with only
 *   `{ appDir: true }` (next/dist/client/app-index.js), so that automatic
 *   pickup is a no-op for those. AnalyticsScripts.tsx reads `x-nonce` itself
 *   and passes `nonce` explicitly into every one of them instead.
 *
 * This REQUEST header is deliberately hardcoded to the literal
 * `Content-Security-Policy` and must stay that way regardless of what the
 * RESPONSE header is named — Next's app-render looks for that exact name to
 * recover the nonce. The RESPONSE header, the one browsers actually enforce
 * against, goes out under `CSP_RESPONSE_HEADER` (see src/lib/csp.ts for why
 * that's report-only for the first deploy, and why that's the one and only
 * place to flip when it's time to enforce).
 *
 * btoa, not Buffer: the proxy declares no runtime, so it runs on the Edge
 * runtime where Buffer does not exist. crypto.randomUUID is a global there.
 * A base64 value is required because the CSP nonce grammar only accepts
 * base64 characters — a raw UUID's hyphens are not valid there.
 *
 * Lives in its own module (not src/proxy.ts) so the hosted overlay
 * (src/hosted/proxy.ts) can use it without a circular import through the
 * config-overlay-proxy seam.
 */
export function withCsp(req: NextRequest, respond: (headers: Headers) => NextResponse): NextResponse {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = respond(requestHeaders)
  response.headers.set(CSP_RESPONSE_HEADER, csp)
  return response
}

/** Rewrite the request to a store's route subtree, carrying the CSP headers. */
export function rewriteToStore(req: NextRequest, slug: string): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = `/store/${slug}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`
  return withCsp(req, (headers) => NextResponse.rewrite(url, { request: { headers } }))
}

export type ProxyHandler = (req: NextRequest) => Promise<NextResponse> | NextResponse
