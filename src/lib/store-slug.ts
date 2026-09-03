/**
 * The route segment the one store is served under (`/store/<slug>/...`). The
 * proxy rewrites every storefront request into it; visitors never see it.
 * The hosted product resolves the slug from the request host instead
 * (src/hosted/store-resolver.ts) and only falls back to this in its legacy
 * single-tenant flag mode.
 */
export const STORE_SLUG = 'store'
