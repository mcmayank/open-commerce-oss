/**
 * The one place the e2e suite decides what host tenants live on.
 *
 * `*.localhost`, NOT `*.lvh.me`, and the reason is security-context rules
 * rather than DNS. Browsers treat `localhost` and any `*.localhost` subdomain
 * as a POTENTIALLY TRUSTWORTHY origin even over plain http, so `Secure`
 * cookies are stored there. `lvh.me` is an ordinary public domain that happens
 * to resolve to 127.0.0.1, so over http it is not a secure context and every
 * `Secure` cookie is silently dropped.
 *
 * That distinction cost a whole feature its CI coverage. The suite runs a
 * PRODUCTION build on CI, where Next marks its own `__prerender_bypass`
 * draft-mode cookie `Secure`; on `*.lvh.me` the browser dropped it, draft mode
 * never turned on, the page-builder preview iframe never mounted its bridge,
 * and the in-place canvas-editing test had to be skipped on CI entirely
 * (Round 2, Ruling E). Moving to `*.localhost` makes the origin trustworthy, so
 * that cookie survives and the test runs everywhere.
 *
 * Chromium resolves `*.localhost` itself without consulting DNS, so no
 * `/etc/hosts` entry is needed for the browser. The CI workflow still adds them
 * for anything Node-side that might resolve a tenant host through the OS.
 */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

/** `http://<slug>.<root>` — the storefront origin for one tenant. */
export function tenantUrl(slug: string): string {
  return `http://${slug}.${ROOT_DOMAIN}`
}

/** The platform/admin origin, i.e. the root domain with no tenant subdomain. */
export const APEX_URL = `http://${ROOT_DOMAIN}`
