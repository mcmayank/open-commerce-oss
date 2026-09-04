/**
 * POST /api/imports
 *
 * The front door. Creates a job for a pasted store address, runs discovery, and
 * hands back the id of the review screen.
 *
 * The merchant is NOT asked which platform they are on. `detect()` walks the
 * registry and the first adapter to claim the origin wins — asking would add a
 * step and a way to be wrong, and plenty of merchants do not know their site
 * runs WooCommerce.
 *
 * Auth: tenant is ALWAYS derived from the authenticated user, never the body.
 * That matters more here than usual, because the body also carries a URL this
 * server is about to fetch.
 */
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { runDiscovery, normalizeToOrigin } from '@/imports/core/discover'
import { sourceRegistry } from '@/imports/core/source-registry'
import { safeFetch } from '@/imports/core/fetch'
import { storeWhere, storeRef } from '@/store-scope'

/**
 * Discovery reads a whole catalog, and a WooCommerce store pays one request per
 * variation on top. 300s is the ceiling this can ask for; past that the answer
 * is incremental discovery ticks, not a bigger number.
 */
export const maxDuration = 300

/**
 * How many products one discovery run will map.
 *
 * Deliberately NOT the plan's product cap: a merchant on a 30-product plan
 * whose store has 250 should see all 250 and choose which 30 to bring, rather
 * than be handed an arbitrary first 30.
 */
const DISCOVERY_LIMIT = 500

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    sourceUrl?: string
    tenantId?: number
  }

  const typedUser = user as TenantsArrayUser
  const ownTenants = getUserTenantIDs(typedUser)
  const tenantId = isSuperAdmin(typedUser) ? (body.tenantId ?? ownTenants[0]) : ownTenants[0]
  if (tenantId === undefined) {
    return NextResponse.json({ error: 'No store to import into.' }, { status: 400 })
  }

  // Validate the address before creating a job, so a typo does not leave a
  // failed row behind on the merchant's dashboard.
  const origin = normalizeToOrigin(body.sourceUrl ?? '')
  if (!origin) {
    return NextResponse.json(
      { error: 'That does not look like a web address. Try something like mystore.com.' },
      { status: 400 },
    )
  }

  const { docs: settings } = await payload.find({
    collection: 'store-settings',
    where: storeWhere(tenantId),
    limit: 1,
    depth: 0, // only `currency` is read
    overrideAccess: true,
  })
  const storeCurrency = (settings[0] as { currency?: string } | undefined)?.currency ?? 'USD'

  const job = (await payload.create({
    collection: 'import-jobs',
    data: {
      ...storeRef(tenantId),
      sourceUrl: origin.toString(),
      status: 'detecting',
      sourceCurrency: storeCurrency,
      createdBy: user.id,
    } as never,
    overrideAccess: true,
  })) as { id: number }

  try {
    const result = await runDiscovery({
      job: { id: job.id, sourceUrl: origin.toString(), storeId: tenantId as number },
      storeCurrency,
      maxProducts: DISCOVERY_LIMIT,
      registry: sourceRegistry,
      payload,
      fetch: safeFetch,
      log: (message) => payload.logger.info(message),
    })

    return NextResponse.json({
      jobId: job.id,
      sourceId: result.sourceId,
      detectedProductCount: result.detectedProductCount,
    })
  } catch (err) {
    // runDiscovery has already marked the job failed with this message; it is
    // written for the merchant, so it is safe to return verbatim.
    return NextResponse.json(
      { error: (err as Error).message, jobId: job.id },
      { status: 422 },
    )
  }
}
