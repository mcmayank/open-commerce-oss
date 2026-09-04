import type { NextRequest } from 'next/server'
import { STORE_SLUG } from '@/lib/store-slug'
import { rewriteToStore, type ProxyHandler } from '@/lib/proxy-csp'
import { compose } from './config-overlay-proxy'

export const config = {
  // skip Payload admin, API routes, Next internals, and files with extensions
  matcher: ['/((?!admin|api|_next|.*\\..*).*)'],
}

/**
 * CORE proxy: one store. Every storefront path is rewritten into the store's
 * subtree, whatever the host. Host → tenant resolution (subdomains, custom
 * domains, the platform apex) is the hosted overlay's job: src/hosted/proxy.ts
 * wraps this via `compose()` (src/config-overlay-proxy.ts), which the OSS
 * export replaces with the identity. See src/lib/proxy-csp.ts for the
 * CSP/nonce story.
 */
export const coreProxy: ProxyHandler = async (req: NextRequest) => rewriteToStore(req, STORE_SLUG)

export const proxy: ProxyHandler = compose(coreProxy)
