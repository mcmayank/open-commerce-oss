import { EXTRA_CONNECT_HOSTS } from '@/csp-overlay'

/**
 * Storefront Content Security Policy. There was none before this file; the
 * custom-CSS injection feature (src/lib/custom-css.ts,
 * src/app/(storefront)/store/[tenant]/components/StoreCustomCss.tsx) is the
 * point at which shipping without one stops being acceptable.
 *
 * Nonce plumbing: src/proxy.ts generates one nonce per request and forwards
 * it two ways — as the `x-nonce` request header, and as part of the
 * `Content-Security-Policy` REQUEST header (not just the response header,
 * which is all the brief this was built from did). The request-header copy
 * lets Next's own app-render (parseRequestHeaders in
 * next/dist/server/app-render/app-render.js) read the nonce back out via
 * getScriptNonceFromHeader and apply it to the framework's OWN
 * server-emitted scripts (RSC flight-data / hydration bootstrap tags).
 *
 * That does NOT cover next/script's client-inserted `afterInteractive`
 * scripts — what @next/third-parties' <GoogleAnalytics>/<GoogleTagManager>
 * and every snippet in src/components/analytics/PixelScripts.tsx use.
 * Confirmed live in a browser: with no explicit `nonce` prop, `window.fbq`,
 * `ttq`, `pintrk`, `snaptr`, `clarity`, `hj`, and `gtag` were all
 * `undefined` after page load — the browser silently dropped every one of
 * those inline scripts under this nonce'd script-src, because App Router's
 * client-side HeadManagerContext.Provider carries no nonce
 * (next/dist/client/app-index.js seeds it with only `{ appDir: true }`), so
 * next/script's own automatic pickup is a no-op there. The fix lives in
 * AnalyticsScripts.tsx: it reads `x-nonce` itself and passes `nonce`
 * explicitly into every one of those components. `x-nonce` still needs to
 * reach StoreTheme/StoreCustomCss too, for their own <style> tags.
 */

/**
 * Third-party hosts the analytics snippets actually load scripts from.
 * Enumerated from src/components/analytics/AnalyticsScripts.tsx and
 * PixelScripts.tsx (the literal `<Script src=...>` / loader URLs baked into
 * each vendor's snippet), not from the field list in analyticsFields.ts —
 * a provider being configurable there doesn't tell you what host its script
 * loads from. GA4/GTM/Google Ads all load from googletagmanager.com.
 */
const ANALYTICS_SCRIPT_HOSTS = [
  'https://www.googletagmanager.com',
  'https://connect.facebook.net',
  'https://analytics.tiktok.com',
  'https://s.pinimg.com',
  'https://sc-static.net',
  'https://www.clarity.ms',
  'https://static.hotjar.com',
]

/**
 * Hosts the same snippets beacon back to once loaded (fetch/XHR/sendBeacon/
 * pixel-via-fetch), plus the noscript `<img>` fallbacks in PixelScripts.tsx.
 * Confirmed live with test ids configured on the `showcase` tenant: a
 * `fetch()` to an allowlisted host (googletagmanager.com) resolved, while
 * the same call to a host NOT on this list was rejected by the browser
 * ("TypeError: Failed to fetch") — proof connect-src is both permissive
 * enough for these and still actually enforced, not accidentally wide open.
 */
const ANALYTICS_CONNECT_HOSTS = [
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://www.googletagmanager.com',
  'https://connect.facebook.net',
  'https://www.facebook.com',
  'https://analytics.tiktok.com',
  'https://s.pinimg.com',
  'https://ct.pinterest.com',
  'https://sc-static.net',
  'https://tr.snapchat.com',
  'https://www.clarity.ms',
  'https://static.hotjar.com',
  'https://in.hotjar.com',
  'https://vc.hotjar.io',
]

/** The noscript `<img>` beacons (Meta, Pinterest) load from these hosts too. */
const ANALYTICS_IMG_HOSTS = ['https://www.facebook.com', 'https://ct.pinterest.com']

/** Hosted-only connect origins (the voice vendor) come through the seam; see src/hosted/csp.ts. */
const VOICE_CONNECT_HOSTS = EXTRA_CONNECT_HOSTS

/**
 * Hosts two shipped storefront blocks embed as `<iframe>`, both live on
 * every content page (not exercised by the home/product/cart/checkout pages
 * this policy was first checked against, which is exactly how `frame-src
 * 'none'` shipped blocking both of them without a single test catching it):
 *
 * - `src/blocks/VideoEmbed/Component.tsx` renders `<iframe src={src}>` where
 *   `src` comes from `normalizeEmbedUrl` (src/blocks/lib/video-embed.ts).
 *   That function has exactly two return shapes —
 *   `https://www.youtube.com/embed/<id>` or
 *   `https://player.vimeo.com/video/<id>` — both hardcoded template
 *   literals, so these two hosts are exhaustive for every id it can ever
 *   return; there is no third provider and no way for it to emit any other
 *   origin.
 * - `src/blocks/Contact/Component.tsx` renders `<iframe src={mapEmbedUrl}>`
 *   for the `mapSplit`/`mapStacked` variants, where `mapEmbedUrl` is a
 *   free-text field (`src/blocks/Contact/config.ts`) described only as
 *   "Google Maps > Share > Embed a map > copy the src URL" — there is no
 *   format validation on write. The Google Maps Share dialog's "Embed a
 *   map" tab (and the Maps Embed API) both emit `src` URLs on the
 *   `https://www.google.com` origin (`/maps/embed?pb=...` or
 *   `/maps/embed/v1/...`), so that's the host allowlisted here — not `https:`
 *   wholesale, which would reopen exactly the clickjacking/overlay-abuse
 *   surface `frame-ancestors 'none'` and the CSS sanitizer's `position:
 *   fixed` ban exist to close. A merchant who pastes a non-Google embed URL
 *   into this field gets a CSP-blocked, visibly-broken iframe rather than a
 *   silently working arbitrary frame — a deliberate trade, not an oversight.
 */
const IFRAME_HOSTS = ['https://www.youtube.com', 'https://player.vimeo.com', 'https://www.google.com']

/**
 * Cloudflare's signup CAPTCHA (hosted-only: the signup form's bot check).
 * One host, three directives: `api.js` is a `<script src>` load, the widget
 * itself renders inside an iframe Turnstile injects, and the widget makes its
 * own XHR calls back to the same host to run the challenge and refresh
 * expiring tokens.
 */
const TURNSTILE_HOST = 'https://challenges.cloudflare.com'

/**
 * The cross-origin stylesheet host the site loads fonts from. The marketing
 * site links it directly in `src/app/(platform)/layout.tsx` (Space Grotesk,
 * Space Mono, Geist). The storefront's link is per-store and built at runtime
 * by `src/lib/fonts/url.ts`, from the family a merchant picked — so the family
 * list is no longer fixed, but the host is.
 *
 * This has to appear on `style-src-elem`, not just `style-src`: per CSP3
 * style-src-elem governs `<link rel="stylesheet">` as well as `<style>`, so a
 * nonce-only style-src-elem blocks the font stylesheet outright — every tenant
 * on a non-system font falls silently back to system-ui/Georgia, and the
 * marketing site loses its typography. `src/proxy.ts`'s matcher covers both
 * route groups, so it is the whole site, not one of them. It is repeated on the
 * `style-src` fallback because a browser without CSP3 support falls back to
 * style-src for elements and would otherwise block it there instead.
 *
 * Held by the font-host tests in csp.test.ts, which derive these hosts by
 * reading both layout files rather than restating them.
 */
const FONT_STYLESHEET_HOSTS = ['https://fonts.googleapis.com']

/**
 * The host the linked Google Fonts stylesheet's own `@font-face src` rules
 * fetch the font files from. Both layouts preconnect to it without ever linking
 * it, which is exactly the shape of a font-file host.
 *
 * `font-src`'s existing `https:` token already admits this, so listing it is
 * deliberately redundant *today*: it states the dependency at the site instead
 * of leaving it resting on a wildcard, and it means a future narrowing of that
 * `https:` — the obvious next tightening of this policy — cannot silently break
 * every web font on the site.
 */
const FONT_FILE_HOSTS = ['https://fonts.gstatic.com']

/**
 * Builds the storefront CSP for one request, bound to its nonce.
 *
 * style-src is split three ways (CSP Level 3) because a single `style-src`
 * governs both `<style>` elements and inline `style="…"` attributes, and this
 * storefront depends on the latter: src/blocks/index.tsx wraps every block in
 * `<div style={sectionVars(scheme)}>`, and ten+ Component.tsx files under
 * src/blocks/*​/Component.tsx set inline background/border/radius styles.
 * A nonce cannot be attached to a style attribute — there's nowhere on the
 * attribute to put one — so attributes can only be allowed via
 * 'unsafe-inline' on style-src-attr. Splitting it out means style-src-elem
 * stays nonce-locked (only StoreTheme's and StoreCustomCss's own <style>
 * tags, plus same-origin <link> stylesheets, pass) while attributes remain
 * permitted. The combined `style-src` fallback exists for browsers that
 * don't understand the split-out CSP3 directives; per spec they'll fall back
 * to it for both elements and attributes, so it carries both the nonce and
 * 'unsafe-inline' (browsers that DO understand nonces ignore 'unsafe-inline'
 * in a directive that also has a nonce/hash source, so evergreen browsers
 * still get the nonce-locked behavior — the 'unsafe-inline' there is dead
 * weight for them, not a hole).
 */
/**
 * The header name the RESPONSE carries the policy on.
 *
 * This is `Content-Security-Policy-Report-Only` for the first production
 * deploy, deliberately: this policy has been verified against exactly one
 * local tenant, and production has 7 active tenants with real analytics
 * providers, custom domains, and block combinations (VideoEmbed, Contact
 * maps, merchant custom CSS) that were never rendered during development.
 * Two directive bugs (`frame-src 'none'`, `style-src-elem` blocking Google
 * Fonts) were already found late in review by people going looking, not by
 * any test — a CSP failure is silent, so shipping straight to enforcing
 * risks silently breaking a font, a tracking pixel, or an embed on a tenant
 * nobody happened to click through. Report-only collects real violations
 * from production traffic without blocking anything, so the switch to
 * enforcing can be made once it's quiet.
 *
 * Limitation, on purpose: there is no reporting endpoint (`report-to` /
 * `report-uri`) wired up — that's out of scope here. Report-only with no
 * endpoint means violations land only in each visitor's own browser
 * console; nobody is notified automatically. To actually check for
 * violations, open a production storefront, a product page, a page that
 * uses the VideoEmbed or Contact map block, and the marketing site, then
 * read each browser console for "Report Only" violation messages.
 *
 * Flipping to enforcing later is meant to be a one-line change: change this
 * constant's value to `'Content-Security-Policy'`. Nothing else needs to
 * move — every read of this policy's response header should go through this
 * export.
 *
 * `Content-Security-Policy` is NOT this constant, on purpose. `proxy.ts`
 * sets a same-named REQUEST header separately, hardcoded to the literal
 * string, and that one must NEVER become this constant: Next's own
 * app-render (`getScriptNonceFromHeader`) looks for a request header named
 * exactly `Content-Security-Policy` to recover the nonce for its own
 * server-emitted scripts (RSC flight-data / hydration bootstrap). Routing
 * the request header through this export would silently rename it the
 * moment this flips to enforcing, Next would stop finding the nonce, and
 * its own inline scripts would go un-nonced — invisible while report-only,
 * and breakage the moment anyone flips the switch.
 */
export const CSP_RESPONSE_HEADER = 'Content-Security-Policy-Report-Only'

export function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    // `blob:` is here for the voice assistant, and it is a real concession worth
    // understanding before anyone flips this to enforcing. The vendor SDK ships
    // its AudioWorklet processors as inlined source strings and loads them via
    // `URL.createObjectURL` — and AudioWorklet's `addModule()` is governed by
    // script-src, not worker-src. There is no way to run the SDK's audio path
    // without it short of extracting those strings into files at build time,
    // which its own `workletPaths` option supports and which is the right
    // follow-up. `data:` is deliberately NOT added: the SDK falls back to it
    // only for Safari inside an iframe, which storefronts are not, and it is the
    // broader of the two grants.
    `script-src 'self' 'nonce-${nonce}' blob: ${ANALYTICS_SCRIPT_HOSTS.join(' ')} ${TURNSTILE_HOST}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' ${FONT_STYLESHEET_HOSTS.join(' ')}`,
    `style-src-elem 'self' 'nonce-${nonce}' ${FONT_STYLESHEET_HOSTS.join(' ')}`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data: https: ${FONT_FILE_HOSTS.join(' ')}`,
    `connect-src 'self' ${ANALYTICS_CONNECT_HOSTS.join(' ')} ${VOICE_CONNECT_HOSTS.join(' ')} ${TURNSTILE_HOST}`,
    `frame-src ${IFRAME_HOSTS.join(' ')} ${TURNSTILE_HOST}`,
    `frame-ancestors 'none'`,
    // Restricted to our own origin because nothing shipped POSTs a form
    // cross-origin today. One shape is declared that would:
    // `startCheckout`'s `kind: 'form'` redirect (src/payments/core/types.ts),
    // which src/app/(storefront)/store/[tenant]/checkout/PaymentRedirector.tsx
    // auto-submits to the gateway's own domain. None of the seven current
    // adapters returns it, so nothing breaks now — but the first adapter that
    // does (APS, HyperPay, CCAvenue) MUST add that gateway's form-POST origin
    // here, or the browser blocks the submit and the customer is stranded on a
    // "Redirecting you to the payment provider…" screen with no error. Widening
    // it speculatively would weaken the directive for every merchant to no
    // benefit, so it is left narrow and flagged at both sites instead.
    `form-action 'self'`,
    `base-uri 'self'`,
  ].join('; ')
}

export {
  ANALYTICS_SCRIPT_HOSTS,
  ANALYTICS_CONNECT_HOSTS,
  VOICE_CONNECT_HOSTS,
  ANALYTICS_IMG_HOSTS,
  IFRAME_HOSTS,
  FONT_STYLESHEET_HOSTS,
  FONT_FILE_HOSTS,
  TURNSTILE_HOST,
}
