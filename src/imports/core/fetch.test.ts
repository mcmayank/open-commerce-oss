import { describe, it, expect } from 'vitest'
import { createSafeFetch, type SafeFetchDeps } from './fetch'

/**
 * A public address, used whenever a test needs DNS to succeed uneventfully.
 * TEST-NET-3 would be more correct in spirit but it is itself a reserved
 * range, and the point of these tests is to prove reserved ranges are blocked.
 */
const PUBLIC_IP = '93.184.216.34'

function deps(overrides: Partial<SafeFetchDeps> = {}): SafeFetchDeps {
  return {
    lookup: async () => [PUBLIC_IP],
    fetchImpl: async () => new Response('{}', { status: 200 }),
    sleep: async () => {},
    now: () => 0,
    ...overrides,
  }
}

describe('safeFetch — scheme handling', () => {
  it('rejects a scheme that is not http or https', async () => {
    const safeFetch = createSafeFetch(deps())

    for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'data:text/html,hi']) {
      const result = await safeFetch(url)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('unreachable')
      expect(result.reason).toBe('BLOCKED_HOST')
    }
  })

  // The merchant pastes whatever is in their address bar. We never send the
  // request in plaintext, so http is upgraded rather than refused outright.
  it('upgrades an http URL to https rather than fetching it in plaintext', async () => {
    const seen: string[] = []
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: async (input) => {
          seen.push(String(input))
          return new Response('{}', { status: 200 })
        },
      }),
    )

    const result = await safeFetch('http://example.com/products.json')

    expect(result.ok).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe('https://example.com/products.json')
  })
})

describe('safeFetch — address blocking', () => {
  // Each of these is a destination that must never be reachable from a
  // user-supplied URL. 169.254.169.254 is the cloud metadata endpoint and is
  // the single most valuable target of the class.
  const blocked: [label: string, ip: string][] = [
    ['loopback', '127.0.0.1'],
    ['loopback, non-canonical', '127.99.1.5'],
    ['cloud metadata', '169.254.169.254'],
    ['link-local', '169.254.0.1'],
    ['private 10/8', '10.0.0.7'],
    ['private 172.16/12', '172.16.5.4'],
    ['private 192.168/16', '192.168.1.1'],
    ['carrier-grade NAT', '100.64.0.1'],
    ['unspecified', '0.0.0.0'],
    ['broadcast', '255.255.255.255'],
    ['multicast', '224.0.0.1'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unique-local', 'fd00::1'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv4-mapped IPv6 loopback', '::ffff:127.0.0.1'],
  ]

  for (const [label, ip] of blocked) {
    it(`blocks ${label} (${ip})`, async () => {
      let fetched = false
      const safeFetch = createSafeFetch(
        deps({
          lookup: async () => [ip],
          fetchImpl: async () => {
            fetched = true
            return new Response('{}', { status: 200 })
          },
        }),
      )

      const result = await safeFetch('https://internal.example.com/x')

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('unreachable')
      expect(result.reason).toBe('BLOCKED_HOST')
      // The point is not the error — it is that no request left the process.
      expect(fetched).toBe(false)
    })
  }

  it('blocks a hostname that resolves to both a public and a private address', async () => {
    const safeFetch = createSafeFetch(deps({ lookup: async () => [PUBLIC_IP, '10.0.0.1'] }))

    const result = await safeFetch('https://split-horizon.example.com/x')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('BLOCKED_HOST')
  })

  it('blocks a literal private IP in the URL, without needing DNS', async () => {
    let looked = false
    const safeFetch = createSafeFetch(
      deps({
        lookup: async () => {
          looked = true
          return [PUBLIC_IP]
        },
      }),
    )

    const result = await safeFetch('https://169.254.169.254/latest/meta-data/')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('BLOCKED_HOST')
    expect(looked).toBe(false)
  })

  it('allows a public address through', async () => {
    const safeFetch = createSafeFetch(deps())

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.status).toBe(200)
    expect(result.body.toString()).toBe('{}')
  })

  it('reports a DNS failure as NETWORK, not as a block', async () => {
    const safeFetch = createSafeFetch(
      deps({
        lookup: async () => {
          throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
        },
      }),
    )

    const result = await safeFetch('https://nope.example.com/x')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('NETWORK')
  })

})

/** A fetchImpl that replays a scripted list of responses, one per call. */
function scripted(...responses: Response[]) {
  const seen: string[] = []
  let i = 0
  const impl: typeof fetch = async (input) => {
    seen.push(String(input))
    const next = responses[i++]
    if (!next) throw new Error(`unexpected request #${i}: ${String(input)}`)
    return next
  }
  return { impl, seen }
}

const redirectTo = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } })

describe('safeFetch — redirects', () => {
  it('follows a redirect to another public host', async () => {
    const { impl, seen } = scripted(
      redirectTo('https://cdn.example.com/final'),
      new Response('done', { status: 200 }),
    )
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/start')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.body.toString()).toBe('done')
    expect(result.url).toBe('https://cdn.example.com/final')
    expect(seen).toEqual(['https://example.com/start', 'https://cdn.example.com/final'])
  })

  // The attack this whole module exists to stop: a host that passes the first
  // address check and then hands us a Location pointing at the metadata endpoint.
  it('blocks a redirect that lands on a private address', async () => {
    const { impl, seen } = scripted(
      redirectTo('https://169.254.169.254/latest/meta-data/'),
      new Response('secrets', { status: 200 }),
    )
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/start')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('BLOCKED_HOST')
    // The redirect was never followed.
    expect(seen).toEqual(['https://example.com/start'])
  })

  it('blocks a redirect whose host resolves to a private address', async () => {
    const { impl } = scripted(
      redirectTo('https://internal.example.com/x'),
      new Response('secrets', { status: 200 }),
    )
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: impl,
        lookup: async (hostname) =>
          hostname === 'internal.example.com' ? ['10.0.0.1'] : [PUBLIC_IP],
      }),
    )

    const result = await safeFetch('https://example.com/start')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('BLOCKED_HOST')
  })

  it('resolves a relative Location against the current URL', async () => {
    const { impl, seen } = scripted(
      redirectTo('/moved'),
      new Response('done', { status: 200 }),
    )
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/deep/start')

    expect(result.ok).toBe(true)
    expect(seen[1]).toBe('https://example.com/moved')
  })

  it('gives up after 3 redirects', async () => {
    const { impl, seen } = scripted(
      redirectTo('https://example.com/1'),
      redirectTo('https://example.com/2'),
      redirectTo('https://example.com/3'),
      redirectTo('https://example.com/4'),
      new Response('never', { status: 200 }),
    )
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/start')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('HTTP_ERROR')
    // Initial request plus exactly 3 followed hops.
    expect(seen).toHaveLength(4)
  })

  it('treats a redirect with no Location as an HTTP error', async () => {
    const { impl } = scripted(new Response(null, { status: 302 }))
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/start')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('HTTP_ERROR')
  })
})

describe('safeFetch — response status', () => {
  it('reports a non-2xx response as HTTP_ERROR carrying the status', async () => {
    const { impl } = scripted(new Response('nope', { status: 404 }))
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('HTTP_ERROR')
    expect(result.status).toBe(404)
  })
})

/** A Response whose body arrives in chunks, so size enforcement is observable. */
function streaming(chunks: string[], init: ResponseInit = {}) {
  let cancelled = false
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
      controller.close()
    },
    cancel() {
      cancelled = true
    },
  })
  return { response: new Response(stream, { status: 200, ...init }), wasCancelled: () => cancelled }
}

describe('safeFetch — response size', () => {
  it('aborts a body that exceeds the cap', async () => {
    const { response } = streaming(['0123456789', '0123456789', '0123456789'])
    const safeFetch = createSafeFetch(deps({ fetchImpl: async () => response }))

    const result = await safeFetch('https://example.com/big', { maxBytes: 15 })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('TOO_LARGE')
  })

  it('stops reading the stream once the cap is passed', async () => {
    const { response, wasCancelled } = streaming(['0123456789', '0123456789', '0123456789'])
    const safeFetch = createSafeFetch(deps({ fetchImpl: async () => response }))

    await safeFetch('https://example.com/big', { maxBytes: 15 })

    expect(wasCancelled()).toBe(true)
  })

  // A hostile source can under-report its size. The cap has to hold on bytes
  // actually received, not on what the header claims.
  it('does not let a small Content-Length smuggle a large body past the cap', async () => {
    const { response } = streaming(['0123456789', '0123456789', '0123456789'], {
      headers: { 'content-length': '5' },
    })
    const safeFetch = createSafeFetch(deps({ fetchImpl: async () => response }))

    const result = await safeFetch('https://example.com/liar', { maxBytes: 15 })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('TOO_LARGE')
  })

  // The mirror of the above: an over-reported header must not cause a false
  // rejection of a body that is actually small.
  it('does not reject on an inflated Content-Length alone', async () => {
    const { response } = streaming(['ok'], { headers: { 'content-length': '999999999' } })
    const safeFetch = createSafeFetch(deps({ fetchImpl: async () => response }))

    const result = await safeFetch('https://example.com/overstated', { maxBytes: 15 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.body.toString()).toBe('ok')
  })

  it('accepts a body exactly at the cap', async () => {
    const { response } = streaming(['0123456789'])
    const safeFetch = createSafeFetch(deps({ fetchImpl: async () => response }))

    const result = await safeFetch('https://example.com/exact', { maxBytes: 10 })

    expect(result.ok).toBe(true)
  })
})

describe('safeFetch — timeout', () => {
  it('reports a request that outruns its budget as TIMEOUT, not NETWORK', async () => {
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError')),
            )
          }),
      }),
    )

    const result = await safeFetch('https://example.com/slow', { timeoutMs: 5 })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('TIMEOUT')
  })
})

describe('safeFetch — retry', () => {
  it('retries a 503 and returns the eventual success', async () => {
    const { impl, seen } = scripted(
      new Response('down', { status: 503 }),
      new Response('up', { status: 200 }),
    )
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.body.toString()).toBe('up')
    expect(seen).toHaveLength(2)
  })

  it('retries a network error', async () => {
    let calls = 0
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: async () => {
          calls++
          if (calls === 1) throw new Error('ECONNRESET')
          return new Response('up', { status: 200 })
        },
      }),
    )

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(true)
    expect(calls).toBe(2)
  })

  it('honours Retry-After on a 429', async () => {
    const slept: number[] = []
    const { impl } = scripted(
      new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }),
      new Response('ok', { status: 200 }),
    )
    const safeFetch = createSafeFetch(
      deps({ fetchImpl: impl, sleep: async (ms) => void slept.push(ms) }),
    )

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(true)
    expect(slept).toContain(2000)
  })

  it('gives up after 3 attempts and reports the last status', async () => {
    const { impl, seen } = scripted(
      new Response('down', { status: 503 }),
      new Response('down', { status: 503 }),
      new Response('down', { status: 503 }),
    )
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('HTTP_ERROR')
    expect(result.status).toBe(503)
    expect(seen).toHaveLength(3)
  })

  // A 404 means the feed is off, not that the server is busy. Retrying it
  // triples the load on a store that has already given a final answer.
  it('does not retry a 404', async () => {
    const { impl, seen } = scripted(new Response('gone', { status: 404 }))
    const safeFetch = createSafeFetch(deps({ fetchImpl: impl }))

    const result = await safeFetch('https://example.com/products.json')

    expect(result.ok).toBe(false)
    expect(seen).toHaveLength(1)
  })
})

describe('safeFetch — per-origin politeness', () => {
  it('waits the minimum gap between two requests to the same origin', async () => {
    const slept: number[] = []
    const safeFetch = createSafeFetch(deps({ sleep: async (ms) => void slept.push(ms) }))

    await safeFetch('https://example.com/a')
    await safeFetch('https://example.com/b')

    // First request pays nothing; the second waits out the gap.
    expect(slept).toEqual([250])
  })

  it('does not make one origin wait for another', async () => {
    const slept: number[] = []
    const safeFetch = createSafeFetch(deps({ sleep: async (ms) => void slept.push(ms) }))

    await safeFetch('https://example.com/a')
    await safeFetch('https://other.example.org/a')

    expect(slept).toEqual([])
  })

  it('runs at most 2 requests against one origin at a time', async () => {
    let inFlight = 0
    let peak = 0
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: async () => {
          inFlight++
          peak = Math.max(peak, inFlight)
          await new Promise((resolve) => setTimeout(resolve, 1))
          inFlight--
          return new Response('ok', { status: 200 })
        },
      }),
      { minGapMs: 0 },
    )

    const results = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((p) => safeFetch(`https://example.com/${p}`)),
    )

    expect(results.every((r) => r.ok)).toBe(true)
    expect(peak).toBe(2)
  })

  it('releases its slot when a request fails, so the origin does not deadlock', async () => {
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: async () => {
          throw new Error('ECONNRESET')
        },
      }),
      { minGapMs: 0 },
    )

    // Three sequential failures against one origin. If a slot leaked on the
    // error path, the third would hang rather than return.
    for (let i = 0; i < 3; i++) {
      const result = await safeFetch('https://example.com/x')
      expect(result.ok).toBe(false)
    }
  })
})

describe('safeFetch — request hygiene', () => {
  it('identifies itself and sends no credentials', async () => {
    let init: RequestInit | undefined
    const safeFetch = createSafeFetch(
      deps({
        fetchImpl: async (_input, requestInit) => {
          init = requestInit
          return new Response('{}', { status: 200 })
        },
      }),
    )

    await safeFetch('https://example.com/products.json')

    const headers = new Headers(init?.headers)
    expect(headers.get('user-agent')).toMatch(/niblr/i)
    expect(init?.credentials).toBe('omit')
    // Redirects must be ours to inspect, never the runtime's to follow.
    expect(init?.redirect).toBe('manual')
  })
})
