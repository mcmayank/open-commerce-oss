/**
 * The ONLY way import code reaches the network.
 *
 * Every URL this module fetches was typed in by a merchant, which makes it an
 * SSRF primitive by construction: the server is being asked to make requests to
 * an address the user chose, from inside a network that can see a cloud
 * metadata endpoint and a database. So the destination is checked before the
 * socket is opened, and the check is on the resolved ADDRESS, never on the
 * hostname — `internal.example.com` resolving to 10.0.0.1 is the whole attack.
 *
 * Nothing else in `src/imports/` may call `fetch` directly; `no-direct-fetch.test.ts`
 * enforces that.
 */
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type SafeFetchReason =
  | 'BLOCKED_HOST'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'HTTP_ERROR'
  | 'NETWORK'

export type SafeFetchResult =
  | { ok: true; status: number; headers: Headers; body: Buffer; url: string }
  | { ok: false; reason: SafeFetchReason; status?: number; message: string }

export type SafeFetchDeps = {
  /** Resolve a hostname to every address it maps to. */
  lookup: (hostname: string) => Promise<string[]>
  fetchImpl: typeof fetch
  sleep: (ms: number) => Promise<void>
  now: () => number
}

export type SafeFetchOptions = {
  /**
   * Hard ceiling on bytes accepted, enforced while streaming. Defaults to the
   * JSON budget; image callers pass `MAX_IMAGE_BYTES`.
   */
  maxBytes?: number
  /** Total budget for the request, including every redirect hop. */
  timeoutMs?: number
}

export type SafeFetch = (url: string, opts?: SafeFetchOptions) => Promise<SafeFetchResult>

/** Catalog JSON. Generous — a 250-product Shopify page is well under this. */
export const MAX_JSON_BYTES = 10 * 1024 * 1024
/** Image bytes. Matches `upload.limits.fileSize` in `payload.config.ts`. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
/** Total per-request budget. */
export const DEFAULT_TIMEOUT_MS = 30_000

// ── Address classification ───────────────────────────────────────────────────

/** [network, prefix-length] pairs that must never be reachable. */
const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC 1918
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. the 169.254.169.254 metadata endpoint
  ['172.16.0.0', 12], // RFC 1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC 1918
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, incl. 255.255.255.255 broadcast
]

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    out = (out << 8) | n
  }
  return out >>> 0
}

function isBlockedV4(ip: string): boolean {
  const addr = v4ToInt(ip)
  if (addr === null) return true // unparseable is not safe
  for (const [network, bits] of BLOCKED_V4) {
    const net = v4ToInt(network)
    if (net === null) continue
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    if ((addr & mask) >>> 0 === (net & mask) >>> 0) return true
  }
  return false
}

/** Expand an IPv6 literal into its eight 16-bit groups, or null if malformed. */
function v6Groups(ip: string): number[] | null {
  let text = ip.split('%')[0] // drop any zone index
  let tail: number[] = []

  // A trailing dotted quad (::ffff:127.0.0.1) contributes the last two groups.
  const lastColon = text.lastIndexOf(':')
  const maybeV4 = text.slice(lastColon + 1)
  if (maybeV4.includes('.')) {
    const addr = v4ToInt(maybeV4)
    if (addr === null) return null
    tail = [addr >>> 16, addr & 0xffff]
    text = text.slice(0, lastColon + 1)
    if (text.endsWith('::')) text = text.slice(0, -1)
    else text = text.slice(0, -1)
  }

  const halves = text.split('::')
  if (halves.length > 2) return null

  const parse = (chunk: string): number[] | null => {
    if (chunk === '') return []
    const out: number[] = []
    for (const group of chunk.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
      out.push(parseInt(group, 16))
    }
    return out
  }

  const head = parse(halves[0])
  if (head === null) return null

  if (halves.length === 1) {
    const all = [...head, ...tail]
    return all.length === 8 ? all : null
  }

  const rest = parse(halves[1])
  if (rest === null) return null
  const known = head.length + rest.length + tail.length
  if (known > 8) return null
  return [...head, ...Array(8 - known).fill(0), ...rest, ...tail]
}

function isBlockedV6(ip: string): boolean {
  const g = v6Groups(ip)
  if (g === null) return true // unparseable is not safe

  // IPv4-mapped (::ffff:a.b.c.d) is an IPv4 destination wearing a costume.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return isBlockedV4([g[6] >>> 8, g[6] & 0xff, g[7] >>> 8, g[7] & 0xff].join('.'))
  }

  if (g.every((x) => x === 0)) return true // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

/** True when this address must not be contacted. Unparseable counts as blocked. */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return isBlockedV4(ip)
  if (family === 6) return isBlockedV6(ip)
  return true
}

// ── The fetcher ──────────────────────────────────────────────────────────────

const blocked = (message: string): SafeFetchResult => ({
  ok: false,
  reason: 'BLOCKED_HOST',
  message,
})

const httpError = (message: string, status?: number): SafeFetchResult => ({
  ok: false,
  reason: 'HTTP_ERROR',
  status,
  message,
})

/** How many hops we will follow before assuming the source is looping. */
const MAX_REDIRECTS = 3

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

const USER_AGENT = 'Niblr-Importer/1.0 (+https://niblr.store/docs/import)'

/**
 * Parse and normalise a destination, rejecting schemes we will not speak and
 * upgrading plaintext. `base` is supplied when following a redirect, so a
 * relative `Location` resolves against the URL that issued it.
 */
function normalizeUrl(raw: string, base?: URL): { url: URL } | { error: SafeFetchResult } {
  let url: URL
  try {
    url = base ? new URL(raw, base) : new URL(raw)
  } catch {
    return { error: blocked(`Not a valid URL: ${raw}`) }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: blocked(`Only http and https URLs can be imported from, not ${url.protocol}`) }
  }

  // Never send the request in plaintext. A merchant pastes whatever is in
  // their address bar, and upgrading is friendlier than refusing.
  if (url.protocol === 'http:') url.protocol = 'https:'

  return { url }
}

/** `AbortSignal.timeout` raises TimeoutError; a manual abort raises AbortError. */
function isAbort(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

const TOO_LARGE = Symbol('too-large')

/**
 * Read a body, refusing to buffer more than `maxBytes`.
 *
 * Deliberately does NOT consult `Content-Length`: a hostile source can
 * under-report it, and an honest one can over-report it. Only bytes actually
 * received are counted, and the stream is cancelled the moment the cap is
 * passed so the rest is never pulled over the wire.
 */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<Buffer | typeof TOO_LARGE> {
  if (!response.body) return Buffer.alloc(0)

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return TOO_LARGE
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks)
}

/**
 * Politeness limits. Tunable because Task 4 of the import spec may need to
 * relax the gap for the WooCommerce variation N+1, which issues one request per
 * variation and would otherwise take minutes on a large catalog.
 */
export type SafeFetchLimits = {
  /** Simultaneous requests allowed against a single origin. */
  perOriginConcurrency?: number
  /** Minimum spacing between request starts to a single origin. */
  minGapMs?: number
}

/** Attempts after the first before giving up. */
const MAX_RETRIES = 2

/** A busy or broken server may recover; a 404 has given its final answer. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function backoffMs(response: Response | null, attempt: number): number {
  const header = response?.headers.get('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  }
  return 500 * 2 ** attempt
}

/** Per-origin gate: caps concurrency and spaces out request starts. */
type OriginGate = { active: number; lastStart: number; queue: (() => void)[] }

export function createSafeFetch(deps: SafeFetchDeps, limits: SafeFetchLimits = {}): SafeFetch {
  const perOriginConcurrency = limits.perOriginConcurrency ?? 2
  const minGapMs = limits.minGapMs ?? 250
  const gates = new Map<string, OriginGate>()

  function gateFor(origin: string): OriginGate {
    let gate = gates.get(origin)
    if (!gate) {
      gate = { active: 0, lastStart: Number.NEGATIVE_INFINITY, queue: [] }
      gates.set(origin, gate)
    }
    return gate
  }

  async function acquire(origin: string): Promise<void> {
    const gate = gateFor(origin)
    while (gate.active >= perOriginConcurrency) {
      await new Promise<void>((resolve) => gate.queue.push(resolve))
    }
    gate.active++

    const wait = minGapMs - (deps.now() - gate.lastStart)
    if (wait > 0) await deps.sleep(wait)
    gate.lastStart = deps.now()
  }

  function release(origin: string): void {
    const gate = gateFor(origin)
    gate.active--
    gate.queue.shift()?.()
  }

  /**
   * Resolve and vet a single destination. Returns an error result when the
   * address must not be contacted, or null when it is safe to open the socket.
   */
  async function vetDestination(url: URL): Promise<SafeFetchResult | null> {
    const host = hostnameOf(url)

    // A literal address needs no DNS, and asking for one would let a hostile
    // URL make us resolve names of its choosing.
    if (isIP(host)) {
      return isBlockedAddress(host)
        ? blocked(`Refusing to fetch a private or reserved address: ${host}`)
        : null
    }

    let addresses: string[]
    try {
      addresses = await deps.lookup(host)
    } catch (err) {
      return {
        ok: false,
        reason: 'NETWORK',
        message: `Could not resolve ${host}: ${(err as Error).message}`,
      }
    }

    if (addresses.length === 0) {
      return { ok: false, reason: 'NETWORK', message: `${host} resolved to nothing` }
    }

    // EVERY address must be public. One private answer poisons the name.
    const bad = addresses.find((ip) => isBlockedAddress(ip))
    return bad === undefined
      ? null
      : blocked(`${host} resolves to a private or reserved address (${bad})`)
  }

  return async function safeFetch(
    rawUrl: string,
    opts: SafeFetchOptions = {},
  ): Promise<SafeFetchResult> {
    const maxBytes = opts.maxBytes ?? MAX_JSON_BYTES
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

    const start = normalizeUrl(rawUrl)
    if ('error' in start) return start.error
    let url = start.url

    // One budget for the whole chain, so three slow hops cannot each take the
    // full allowance.
    const signal = AbortSignal.timeout(timeoutMs)

    // <= so the last iteration can report the overrun rather than following it.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const rejection = await vetDestination(url)
      if (rejection) return rejection

      // Retry inside the hop: a flaky server should not cost us a redirect
      // budget, and each attempt re-enters the origin gate on its own.
      let response: Response | null = null
      let failure: SafeFetchResult | null = null

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const origin = url.origin
        await acquire(origin)
        try {
          response = await deps.fetchImpl(url.toString(), {
            redirect: 'manual', // hops are ours to vet, never the runtime's to follow
            credentials: 'omit',
            headers: { 'user-agent': USER_AGENT, accept: '*/*' },
            signal,
          })
        } catch (err) {
          response = null
          if (isAbort(err)) {
            failure = {
              ok: false,
              reason: 'TIMEOUT',
              message: `${url} did not respond in ${timeoutMs}ms`,
            }
            break // a blown budget is not worth retrying into
          }
          failure = { ok: false, reason: 'NETWORK', message: (err as Error).message }
          if (attempt === MAX_RETRIES) break
          await deps.sleep(backoffMs(null, attempt))
          continue
        } finally {
          release(origin)
        }

        failure = null
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          await deps.sleep(backoffMs(response, attempt))
          continue
        }
        break
      }

      if (failure) return failure
      if (!response) {
        /* c8 ignore next -- unreachable: the loop sets one or the other */
        return { ok: false, reason: 'NETWORK', message: `${url} produced no response` }
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location')
        if (!location) {
          return httpError(`${url} returned ${response.status} with no Location`, response.status)
        }
        if (hop === MAX_REDIRECTS) {
          return httpError(`Gave up after ${MAX_REDIRECTS} redirects from ${rawUrl}`)
        }
        const next = normalizeUrl(location, url)
        if ('error' in next) return next.error
        url = next.url
        continue
      }

      if (!response.ok) {
        return httpError(`${url} returned HTTP ${response.status}`, response.status)
      }

      try {
        const body = await readCapped(response, maxBytes)
        if (body === TOO_LARGE) {
          return {
            ok: false,
            reason: 'TOO_LARGE',
            message: `${url} sent more than ${maxBytes} bytes`,
          }
        }
        return {
          ok: true,
          status: response.status,
          headers: response.headers,
          body,
          url: url.toString(),
        }
      } catch (err) {
        if (isAbort(err)) {
          return { ok: false, reason: 'TIMEOUT', message: `${url} stalled mid-body` }
        }
        return { ok: false, reason: 'NETWORK', message: (err as Error).message }
      }
    }

    /* c8 ignore next -- the loop always returns; this satisfies the type checker */
    return httpError(`Gave up after ${MAX_REDIRECTS} redirects from ${rawUrl}`)
  }
}

/** `URL` keeps IPv6 literals in brackets; the address checks want them bare. */
function hostnameOf(url: URL): string {
  const host = url.hostname
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

/** The production instance: real DNS, real fetch, real clock. */
export const safeFetch: SafeFetch = createSafeFetch({
  lookup: async (hostname) => {
    const results = await dnsLookup(hostname, { all: true })
    return results.map((r) => r.address)
  },
  fetchImpl: fetch,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
})
