import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Config } from 'payload'

const storeForHost = vi.fn()
const safeRevalidate = vi.fn()

vi.mock('@/store-loader', () => ({ storeForHost: (...a: unknown[]) => storeForHost(...a) }))
vi.mock('@/lib/storefront-cache', () => ({
  safeRevalidate: (...a: unknown[]) => safeRevalidate(...a),
  tenantTag: (id: string | number, kind: string) => `tenant:${id}:${kind}`,
}))

const { mcpCachePurge, isSuccessfulMcpWrite, MCP_PURGE_PLUGIN_ORDER, MCP_ENDPOINT_PATH } =
  await import('./mcpCachePurge')

type TestEndpoint = { path: string; method: string; handler: (req: unknown) => Promise<Response> }

const configWith = (endpoints: TestEndpoint[]) => ({ endpoints }) as unknown as Config
const endpointsOf = (c: Config) => (c.endpoints ?? []) as unknown as TestEndpoint[]

const WRITE_REPLY = 'event: message\ndata: {"result":{"content":[{"type":"text","text":"Document updated successfully in collection \\"products\\"!"}]}}'
const READ_REPLY = 'event: message\ndata: {"result":{"content":[{"type":"text","text":"Collection: \\"products\\"\\nTotal: 5 documents"}]}}'

const makeEndpoint = (reply: string, over: Partial<TestEndpoint> = {}): TestEndpoint => ({
  path: MCP_ENDPOINT_PATH,
  method: 'post',
  handler: async () => new Response(reply, { status: 200, headers: { 'x-keep': 'yes' } }),
  ...over,
})

const req = { headers: new Headers({ host: 'acme.niblr.store' }) }

beforeEach(() => {
  vi.clearAllMocks()
  storeForHost.mockResolvedValue({ id: 117, slug: 'acme', name: 'Acme', status: 'active', storefrontTheme: 'default', showsPlatformBranding: true })
})

describe('isSuccessfulMcpWrite', () => {
  it('matches the plugin success text for updates and creates', () => {
    expect(isSuccessfulMcpWrite('Document updated successfully in collection "products"!')).toBe(true)
    expect(isSuccessfulMcpWrite('Document created successfully in collection "pages"!')).toBe(true)
  })

  it('does not match reads — purging on every read would make an AI browsing the catalog a cache-miss generator', () => {
    expect(isSuccessfulMcpWrite('Collection: "products"\nTotal: 5 documents')).toBe(false)
  })

  it('does not match errors', () => {
    expect(isSuccessfulMcpWrite('MCP error -32602: Tool updateProducts not found')).toBe(false)
    expect(isSuccessfulMcpWrite('Document update failed in collection "products"')).toBe(false)
  })
})

describe('plugin ordering', () => {
  /**
   * Payload sorts plugins by `order` rather than running them in array order,
   * and `mcpPlugin` declares 10. A default order ran this against a config with
   * no endpoints — wrapping nothing, silently.
   */
  it('declares an order above the MCP plugin', () => {
    expect(mcpCachePurge.order).toBe(MCP_PURGE_PLUGIN_ORDER)
    expect(MCP_PURGE_PLUGIN_ORDER).toBeGreaterThan(10)
  })

  it('is a no-op when the MCP endpoint does not exist', () => {
    expect(endpointsOf(mcpCachePurge(configWith([])) as Config)).toHaveLength(0)
  })
})

describe('endpoint wrapping', () => {
  it('leaves the GET stream endpoint alone', () => {
    const get = makeEndpoint(WRITE_REPLY, { method: 'get' })
    const out = mcpCachePurge(configWith([get])) as Config
    expect(endpointsOf(out)[0]!.handler).toBe(get.handler)
  })

  it('purges every kind for the host tenant after a write', async () => {
    const out = mcpCachePurge(configWith([makeEndpoint(WRITE_REPLY)])) as Config
    await endpointsOf(out)[0]!.handler(req)

    expect(storeForHost.mock.calls[0]![0].get('host')).toBe('acme.niblr.store')
    expect(safeRevalidate.mock.calls.map((c) => c[0])).toEqual([
      'tenant:117:products',
      'tenant:117:categories',
      'tenant:117:pages',
      'tenant:117:settings',
    ])
  })

  it('does NOT purge after a read', async () => {
    const out = mcpCachePurge(configWith([makeEndpoint(READ_REPLY)])) as Config
    await endpointsOf(out)[0]!.handler(req)
    expect(safeRevalidate).not.toHaveBeenCalled()
  })

  it('does not purge when the host resolves to no tenant', async () => {
    storeForHost.mockResolvedValue(null)
    const out = mcpCachePurge(configWith([makeEndpoint(WRITE_REPLY)])) as Config
    await endpointsOf(out)[0]!.handler(req)
    expect(safeRevalidate).not.toHaveBeenCalled()
  })

  it('preserves body, status and headers', async () => {
    const out = mcpCachePurge(configWith([makeEndpoint(WRITE_REPLY)])) as Config
    const res = await endpointsOf(out)[0]!.handler(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-keep')).toBe('yes')
    expect(await res.text()).toBe(WRITE_REPLY)
  })

  /** A purge failure must never fail the merchant's write. */
  it('still returns the reply when tenant resolution throws', async () => {
    storeForHost.mockRejectedValue(new Error('lookup exploded'))
    const out = mcpCachePurge(configWith([makeEndpoint(WRITE_REPLY)])) as Config
    const res = await endpointsOf(out)[0]!.handler(req)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(WRITE_REPLY)
  })
})
