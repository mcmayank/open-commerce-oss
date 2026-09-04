/**
 * POST /api/imports/[id]/tick
 *
 * Processes a slice of an import and reports what is left. The client polls
 * this while the import screen is open.
 *
 * This shape exists because the repo has no background job infrastructure and
 * this feature is not a good reason to add a vendor. A tick fits inside a
 * serverless invocation, survives a closed tab (the next tick picks up where
 * the last stopped), and needs no new dependency.
 */
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { safeFetch } from '@/imports/core/fetch'
import { entitlementsById } from '@/entitlements'
import { claimItems, importItem } from '@/imports/core/import'
import { createImageBudget } from '@/imports/core/media'
import type { ImportJob } from '@/payload-types'
import { storeWhere, storeIdOf } from '@/store-scope'

/**
 * Vercel function budget. The `/api/imports` discovery route sets this too; the
 * tick had none, so it ran at the platform default — and an image-heavy batch
 * blew past it, which is what left an import "stuck".
 */
export const maxDuration = 300

/**
 * Products per invocation.
 *
 * ONE, deliberately. A product with images takes ~10-15s to import (sharp
 * resizes each image to three variants and uploads four objects), so a batch of
 * five took 45-90s — during which the progress bar sat frozen on one number and
 * looked stuck. One product per tick means the bar advances every ~15s, which
 * reads as steady progress rather than a hang. The client keeps polling.
 */
const BATCH = 1

/**
 * A claim older than this is treated as abandoned. If a tick dies mid-import
 * (a timeout, a dropped instance) its claimed-but-unimported item would strand
 * forever otherwise, and the import could never reach 100%.
 */
const STALE_CLAIM_MS = 2 * 60 * 1000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })

  const jobId = Number((await params).id)
  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'Unknown import.' }, { status: 400 })
  }

  const job = (await payload
    .findByID({ collection: 'import-jobs', id: jobId, overrideAccess: true })
    .catch(() => null)) as ImportJob | null
  if (!job) return NextResponse.json({ error: 'Unknown import.' }, { status: 404 })

  const typedUser = user as TenantsArrayUser
  const tenantId = storeIdOf(job)
  if (tenantId === undefined) return NextResponse.json({ error: 'Unknown import.' }, { status: 404 })
  const ownsIt =
    isSuperAdmin(typedUser) ||
    getUserTenantIDs(typedUser).some((id) => String(id) === String(tenantId))
  if (!ownsIt) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })

  if (job.status !== 'importing') {
    return NextResponse.json({ status: job.status, processed: 0, remaining: 0 })
  }

  // The tax answer is a precondition, not a nicety: it is snapshotted onto every
  // product this writes, and there is no way to recover it afterwards.
  if (job.priceTaxTreatment !== 'inclusive' && job.priceTaxTreatment !== 'exclusive') {
    await fail(payload, jobId, 'The tax question was not answered before importing.')
    return NextResponse.json({ error: 'Tax treatment missing.' }, { status: 400 })
  }

  // Plan cap, re-checked server-side every tick. The review screen blocks this
  // too, but the screen is not the boundary — and a long import could cross the
  // cap partway if products were added by another route while it ran.
  const ent = await entitlementsById(payload, tenantId as number)
  const { maxProducts } = ent
  const { totalDocs: productCount } = await payload.count({
    collection: 'products',
    where: storeWhere(tenantId),
    overrideAccess: true,
  })
  if (productCount >= maxProducts) {
    const message =
      `This store has reached its plan limit of ${maxProducts} products, so the import ` +
      `stopped. Products already imported have been kept.`
    await fail(payload, jobId, message)
    return NextResponse.json({ error: message, status: 'failed' }, { status: 409 })
  }

  // Image budget: whatever storage the plan has left. Images are the expensive
  // part of an import and the quota hooks would refuse them one at a time
  // anyway; giving ingest the real number lets it stop cleanly instead.
  const remainingStorage = Math.max(ent.maxStorageBytes - ent.usage.mediaBytesUsed, 0)

  const claimed = await claimItems(payload, jobId, BATCH, () => new Date(), STALE_CLAIM_MS)

  // Content-hash dedupe is shared across this tick's products. It cannot span
  // ticks — each is a separate invocation — so the same file reused by two
  // products in different batches uploads twice. The dominant case, one file
  // reused across a product's own variants, is inside a single item and is
  // covered. Persisting the hash on `media` would close the rest.
  const seen = new Map<string, number>()
  const budget = createImageBudget(remainingStorage)

  let imported = 0
  let failed = 0

  for (const item of claimed) {
    const outcome = await importItem(item, {
      payload,
      tenantId: tenantId as number,
      sourceId: job.sourceId ?? 'unknown',
      sourceOrigin: job.sourceUrl,
      priceTaxTreatment: job.priceTaxTreatment,
      now: () => new Date(),
      log: (message) => payload.logger.info(message),
      media: {
        payload,
        tenantId: tenantId as number,
        fetch: safeFetch,
        log: (message) => payload.logger.info(message),
        seen,
        budget,
      },
    })
    if (outcome.ok) imported++
    else failed++
  }

  const { totalDocs: remaining } = await payload.count({
    collection: 'import-items',
    where: { and: [{ job: { equals: jobId } }, { status: { equals: 'selected' } }] },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'import-jobs',
    id: jobId,
    data: {
      importedCount: (job.importedCount ?? 0) + imported,
      failedCount: (job.failedCount ?? 0) + failed,
      ...(remaining === 0 ? { status: 'completed' as const } : {}),
    },
    overrideAccess: true,
  })

  if (remaining === 0) await pruneFinishedItems(payload, jobId)

  return NextResponse.json({
    processed: claimed.length,
    imported,
    failed,
    remaining,
    status: remaining === 0 ? 'completed' : 'importing',
  })
}

/**
 * Delete the items a finished job no longer needs.
 *
 * `mapped` is roughly 10 KB per product, so a 500-product discovery parks ~5 MB
 * in Postgres — and a merchant who imports, changes their mind and re-imports
 * parks it twice. Once the product exists the payload has served its purpose:
 * provenance lives on `Products.importedFrom`, which is what re-import keys on.
 *
 * FAILED items are deliberately kept. They are the only record of what went
 * wrong and the only thing a retry could work from; deleting them would leave a
 * merchant with a count and no way to act on it.
 */
async function pruneFinishedItems(
  payload: Awaited<ReturnType<typeof getPayload>>,
  jobId: number,
): Promise<void> {
  await payload
    .delete({
      collection: 'import-items',
      where: {
        and: [
          { job: { equals: jobId } },
          { status: { in: ['imported', 'skipped'] } },
        ],
      },
      overrideAccess: true,
    })
    .catch((err) => {
      // Never fail a completed import over cleanup — the products are already
      // written and the merchant's work is done.
      payload.logger.warn(`Could not prune items for import ${jobId}: ${(err as Error).message}`)
    })
}

async function fail(
  payload: Awaited<ReturnType<typeof getPayload>>,
  jobId: number,
  error: string,
): Promise<void> {
  await payload.update({
    collection: 'import-jobs',
    id: jobId,
    data: { status: 'failed', error },
    overrideAccess: true,
  })
}
