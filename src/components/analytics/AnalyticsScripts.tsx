import { headers } from 'next/headers'
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google'
import type { AnalyticsIds } from '@/lib/analytics'
import { PixelScripts } from './PixelScripts'

/**
 * Reads the per-request nonce set by src/proxy.ts. Wrapped because headers()
 * throws outside a request scope — that must yield `undefined` rather than
 * blow up the render, same as a request that genuinely has no `x-nonce`
 * header.
 */
async function readNonce(): Promise<string | undefined> {
  try {
    return (await headers()).get('x-nonce') ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Renders GA4 + (optional) GTM tags plus any configured marketing pixels for one
 * surface. Server component — the tag components are client internally but safe
 * to render from server. Renders nothing for ids that aren't configured.
 *
 * Both the storefront and platform layouts spread `readAnalytics(...)` here, so
 * every id (analytics + pixels) is wired by passing it through this one place.
 *
 * Passes `nonce` explicitly to every one of these, rather than relying on
 * next/script's automatic HeadManagerContext nonce pickup: under App Router,
 * the client-side HeadManagerContext.Provider is seeded with only
 * `{ appDir: true }` (see next/dist/client/app-index.js) — it carries no
 * nonce — so a `strategy="afterInteractive"` Script (what GoogleAnalytics,
 * GoogleTagManager, and every pixel snippet below use) that doesn't take an
 * explicit `nonce` prop is inserted into the DOM with no nonce at all and is
 * silently dropped by the browser under a nonce'd script-src. Confirmed live:
 * without this prop, `window.fbq`/`ttq`/`pintrk`/`snaptr`/`clarity`/`hj`/`gtag`
 * were all `undefined` after page load even with the hosts allowlisted.
 */
export async function AnalyticsScripts({ ga4MeasurementId, gtmContainerId, ...pixels }: AnalyticsIds) {
  const nonce = await readNonce()
  return (
    <>
      {gtmContainerId ? <GoogleTagManager gtmId={gtmContainerId} nonce={nonce} /> : null}
      {ga4MeasurementId ? <GoogleAnalytics gaId={ga4MeasurementId} nonce={nonce} /> : null}
      <PixelScripts {...pixels} nonce={nonce} />
    </>
  )
}
