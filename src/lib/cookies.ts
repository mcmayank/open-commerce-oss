/**
 * Whether the app's own cookies (cart, customer session, preview) carry the
 * `Secure` attribute.
 *
 * One helper rather than three copies of `process.env.NODE_ENV === 'production'`
 * — the cart actions, the customer session and the preview route all need the
 * same answer, and a divergence between them is the kind of bug that presents as
 * "the cart empties itself" rather than as anything cookie-shaped.
 *
 * It briefly carried an `E2E_ALLOW_INSECURE_COOKIES` escape hatch, because the
 * e2e suite ran a production build over plain http on `*.lvh.me`, where the
 * browser silently refused every `Secure` cookie: `addToCartAction` returned the
 * summary it computed in-request so the drawer looked correct, and the NEXT
 * action read back an empty cookie and wiped the cart. The hatch is gone,
 * because the cause is gone — the suite now drives `*.localhost`, which browsers
 * treat as a secure context even over http, so these cookies are stored exactly
 * as they are in production. See tests/helpers/hosts.ts.
 *
 * Do not reintroduce an environment override here. If a future test host cannot
 * hold a `Secure` cookie, move the host, not the security attribute.
 */
export function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production'
}
