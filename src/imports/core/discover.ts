/**
 * Discovery — phase one of three.
 *
 * Reads the merchant's old store once, maps every product, and writes one
 * `ImportItem` per product. It deliberately does NOT move image bytes: the
 * review grid points at the source CDN, and nothing is downloaded until a
 * merchant presses import. That is the difference between moving 1.6 GB up
 * front and moving nothing.
 *
 * Items are written as they arrive rather than collected first, so a large
 * catalog never sits in memory in one piece.
 */
import type { Payload } from 'payload'
import type { SafeFetch } from './fetch'
import type { SourceRegistry } from './source-registry'
import type { ImportWarning, SourceProduct } from './types'
import { storeRef } from '@/store-scope'

export type DiscoveryJob = {
  /**
   * Numeric, not `string | number`. This project is on Postgres, so Payload's
   * generated types make every relationship an integer id — widening to string
   * compiles here and fails at the write.
   */
  id: number
  sourceUrl: string
  storeId: number
}

export type DiscoveryArgs = {
  job: DiscoveryJob
  /** The TARGET store's currency. Adapters read prices against this. */
  storeCurrency: string
  /** Discovery ceiling. The plan cap is enforced separately, before import. */
  maxProducts: number
  registry: SourceRegistry
  payload: Payload
  fetch: SafeFetch
  log: (message: string) => void
}

export type DiscoveryResult = {
  sourceId: string
  detectedProductCount: number
}

/** How many item writes are in flight at once. */
const WRITE_BATCH = 25

/**
 * Phrases that mean the description is store furniture rather than a
 * description of the product. Deliberately short and unambiguous: a false
 * positive here puts a warning chip on a perfectly good description, and a
 * merchant who learns to ignore one chip ignores all of them.
 */
const BOILERPLATE_PHRASES = [
  'add to cart',
  'free shipping',
  'shipping policy',
  'return policy',
  'day returns',
  'size chart',
  'terms and conditions',
  'click here to buy',
]

/** Strip tags so phrase matching sees text rather than markup. */
function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** True when a description is mostly store furniture. */
export function describeBoilerplate(html: string): boolean {
  const text = toText(html ?? '')
  if (text.length === 0) return false
  return BOILERPLATE_PHRASES.some((phrase) => text.includes(phrase))
}

/**
 * Reduce whatever the merchant pasted to an origin. Accepts a bare host,
 * because that is what people type.
 */
export function normalizeToOrigin(raw: string): URL | null {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return null

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  // `new URL('https://not a url at all')` throws, but a single bare word
  // parses as a hostname — require something that looks like a domain.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null

  return new URL(url.origin)
}

function unsupportedPlatform(registry: SourceRegistry, host: string): Error {
  const names = registry
    .list()
    .map((s) => s.label)
    .join(' and ')
  return new Error(
    `${host} does not look like a ${names} store. Those are the only platforms ` +
      `Niblr can import from today — other platforms are not supported yet, and there ` +
      `is no generic fallback. You can still add products by hand, or import a CSV.`,
  )
}

export async function runDiscovery(args: DiscoveryArgs): Promise<DiscoveryResult> {
  const { job, registry, payload, fetch, log } = args

  const fail = async (message: string) => {
    await payload.update({
      collection: 'import-jobs',
      id: job.id,
      data: { status: 'failed', error: message },
      overrideAccess: true,
    })
  }

  const origin = normalizeToOrigin(job.sourceUrl)
  if (!origin) {
    const message = `"${job.sourceUrl}" is not a web address. Paste your storefront address, like mystore.com.`
    await fail(message)
    throw new Error(message)
  }

  // First adapter to claim the origin wins; the rest are never probed.
  let matched: { id: string; note: string } | null = null
  for (const source of registry.list()) {
    const detected = await source.detect(origin, fetch)
    if (detected) {
      matched = { id: source.id, note: detected.note }
      break
    }
  }

  if (!matched) {
    const error = unsupportedPlatform(registry, origin.host)
    await fail(error.message)
    throw error
  }

  log(`Detected ${matched.note} at ${origin.host}.`)
  await payload.update({
    collection: 'import-jobs',
    id: job.id,
    data: { sourceId: matched.id, status: 'detecting' },
    overrideAccess: true,
  })

  const source = registry.require(matched.id)
  // SKUs seen anywhere in this run. An adapter only sees one product at a time,
  // so a SKU reused across two products can only be spotted here.
  const seenSkus = new Set<string>()
  let count = 0
  let batch: Promise<unknown>[] = []

  const flush = async () => {
    if (batch.length === 0) return
    await Promise.all(batch)
    batch = []
  }

  try {
    for await (const mapped of source.listProducts({
      origin,
      storeCurrency: args.storeCurrency,
      fetch,
      maxProducts: args.maxProducts,
      log,
    })) {
      if (count >= args.maxProducts) break

      const warnings = new Set<ImportWarning>(mapped.warnings)
      if (describeBoilerplate(mapped.descriptionHtml)) warnings.add('boilerplate_description')

      for (const variant of mapped.variants) {
        if (!variant.sku) continue
        if (seenSkus.has(variant.sku)) warnings.add('duplicate_sku')
        seenSkus.add(variant.sku)
      }

      batch.push(writeItem(payload, job, mapped, [...warnings]))
      count++

      if (batch.length >= WRITE_BATCH) await flush()
    }

    await flush()
  } catch (err) {
    await flush().catch(() => {})
    const message = (err as Error).message
    await fail(message)
    throw err
  }

  await payload.update({
    collection: 'import-jobs',
    id: job.id,
    data: { status: 'ready', detectedProductCount: count, sourceId: matched.id },
    overrideAccess: true,
  })

  log(`Found ${count} product${count === 1 ? '' : 's'}.`)
  return { sourceId: matched.id, detectedProductCount: count }
}

function writeItem(
  payload: Payload,
  job: DiscoveryJob,
  mapped: SourceProduct,
  warnings: ImportWarning[],
): Promise<unknown> {
  return payload.create({
    collection: 'import-items',
    data: {
      job: job.id,
      ...storeRef(job.storeId),
      externalId: mapped.externalId,
      // What the import phase will write, so neither review nor import needs to
      // touch the source store again.
      mapped: mapped as unknown as Record<string, unknown>,
      status: 'pending',
      warnings,
    },
    overrideAccess: true,
  })
}
