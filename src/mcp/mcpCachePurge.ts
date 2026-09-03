import type { Plugin } from 'payload'
import { storeForHost } from '@/store-loader'
import { safeRevalidate, tenantTag, type TenantCacheKind } from '@/lib/storefront-cache'

/**
 * Purges a tenant's storefront cache after a write made through its MCP server.
 *
 * Without this, a merchant editing over MCP saw their storefront keep serving
 * the previous version until the 1-hour TTL backstop in `getProductBySlug`
 * expired, while the identical edit made in the admin refreshed instantly.
 *
 * WHY THIS DOES NOT USE THE COLLECTION HOOKS. `revalidateTenantHook` already
 * purges on every write and works fine for the admin. It does not work for MCP,
 * and an earlier fix that tried to make it work (queue the tags in the hook,
 * replay them from the endpoint) was reverted after production measurement:
 *
 *     inner@178102 | drained@178229 | flushed@178230:purged=0
 *     flush:enter@178229:{"pending":0,"tags":[]}
 *
 * The queue was empty every time. The hook's `safeRevalidate` was never reached
 * before the response completed, so there was nothing to replay. Making the
 * replay wait longer cannot fix that — the work simply is not done yet, and the
 * platform suspends the function once the response is sent.
 *
 * So this derives the tags itself, from information the request already carries,
 * and never waits on the hook:
 *
 *   - WHETHER a write happened comes from the tool's own reply text, which the
 *     wrapper is holding anyway because it drains the body.
 *   - WHICH tenant comes from the request Host, exactly as `overrideAuth` and
 *     every storefront read already resolve it.
 *
 * That makes it correct regardless of when — or whether — the hook runs.
 *
 * The purge itself happens in the endpoint handler's own scope, NOT inside the
 * MCP transport. That distinction is the point: the transport
 * (`StreamableHTTPServerTransport` -> `@hono/node-server`) runs tool handlers in
 * its own execution context, whereas this wrapper is an ordinary Payload
 * endpoint handler — the same kind of context as the admin REST route, whose
 * `revalidateTag` calls demonstrably do purge production.
 */

/** The path `@payloadcms/plugin-mcp` registers its endpoints on. */
export const MCP_ENDPOINT_PATH = '/mcp'

/**
 * Must stay above `mcpPlugin`'s own `order: 10`. Payload does NOT run plugins in
 * array order — `buildConfig` sorts them by this number (default 0) — so a
 * plugin listed after `mcpPlugin` still ran FIRST, against a config whose
 * `endpoints` was empty, wrapping nothing at all and reporting nothing. That
 * cost real debugging time; `mcpCachePurge.test.ts` pins the relationship.
 */
export const MCP_PURGE_PLUGIN_ORDER = 20

/**
 * Every cache kind an MCP write can invalidate. The MCP server exposes writes to
 * products, categories and pages; `settings` is included because page and
 * product reads populate it at depth.
 *
 * Deliberately purges all of them rather than parsing which collection changed:
 * over-purging costs one cache miss, under-purging shows a merchant stale
 * content, and only the second is a bug worth having.
 */
const PURGED_KINDS: TenantCacheKind[] = ['products', 'categories', 'pages', 'settings']

/**
 * Did this MCP reply report a successful write?
 *
 * Matched against the plugin's own success text ("Document updated successfully
 * in collection ..."), which is the only signal available without consuming the
 * REQUEST body — and consuming that would starve the transport of the body it
 * needs to answer at all.
 *
 * Reads and errors deliberately do not match: purging on every read would turn
 * a merchant's AI browsing their catalog into a cache-miss generator.
 */
export function isSuccessfulMcpWrite(replyText: string): boolean {
  return /Document\s+(?:created|updated)\s+successfully\s+in\s+collection/i.test(replyText)
}

export const mcpCachePurge: Plugin = (config) => {
  const endpoints = config.endpoints ?? []

  return {
    ...config,
    endpoints: endpoints.map((endpoint) => {
      // POST only. GET /mcp is the long-lived SSE stream: it carries no writes,
      // and draining it would block until the stream closed.
      if (endpoint.path !== MCP_ENDPOINT_PATH || endpoint.method !== 'post') return endpoint

      const inner = endpoint.handler
      return {
        ...endpoint,
        handler: async (req: Parameters<typeof inner>[0]) => {
          const response = await inner(req)

          let body: ArrayBuffer | null = null
          try {
            body = await response.arrayBuffer()
          } catch {
            // Not readable (already consumed, or an error response). Nothing to
            // inspect and nothing to rebuild — hand the original back untouched.
            return response
          }

          try {
            const replyText = new TextDecoder().decode(body)
            if (isSuccessfulMcpWrite(replyText)) {
              const store = await storeForHost(req.headers)
              if (store) {
                for (const kind of PURGED_KINDS) {
                  safeRevalidate(tenantTag(store.id, kind))
                }
              }
            }
          } catch {
            // A purge failure must never turn a successful merchant write into a
            // failed MCP call. Worst case the storefront lags to the TTL, which
            // is exactly the behaviour this fix replaces.
          }

          // `arrayBuffer()` consumed the original body, so return a fresh
          // Response carrying the same bytes, status and headers.
          return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          })
        },
      }
    }),
  }
}

mcpCachePurge.order = MCP_PURGE_PLUGIN_ORDER
