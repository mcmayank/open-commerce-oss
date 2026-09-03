/**
 * PATCH /api/imports/[id]/review
 *
 * Saves the review screen's choices and moves the job to `importing`. This is
 * the moment a merchant commits — before it, nothing has touched the catalog.
 *
 * Auth: the tenant is ALWAYS derived from the authenticated user, never from
 * the body, matching `api/contacts/import`. A super-admin may act on any job.
 */
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import type { ImportItem, ImportJob } from '@/payload-types'
import { storeIdOf } from '@/store-scope'

type Body = {
  ownershipAttested?: boolean
  priceTaxTreatment?: 'inclusive' | 'exclusive' | null
  items?: { id: number; status: string; priceMinor: number | null; title?: string }[]
}

const ITEM_STATUSES = new Set(['selected', 'skipped'])

export async function PATCH(
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
  const jobTenantId = storeIdOf(job)
  const ownsIt =
    isSuperAdmin(typedUser) ||
    getUserTenantIDs(typedUser).some((id) => String(id) === String(jobTenantId))
  if (!ownsIt) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as Body

  // The tax answer is required and has no default: guessing makes every price
  // in the catalog wrong by the tax rate, silently and permanently.
  if (body.priceTaxTreatment !== 'inclusive' && body.priceTaxTreatment !== 'exclusive') {
    return NextResponse.json(
      { error: 'Say whether the existing store’s prices include tax.' },
      { status: 400 },
    )
  }
  if (!body.ownershipAttested) {
    return NextResponse.json({ error: 'Ownership must be confirmed.' }, { status: 400 })
  }

  const rows = Array.isArray(body.items) ? body.items : []

  // Load this job's items once, so an edit can be merged into `mapped` and a
  // row belonging to another job can be dropped without a query each.
  const { docs } = await payload.find({
    collection: 'import-items',
    where: { job: { equals: jobId } },
    limit: 5000,
    overrideAccess: true,
  })
  const owned = new Map((docs as ImportItem[]).map((d) => [d.id, d]))

  const selectedIds: number[] = []
  const skippedIds: number[] = []
  let selected = 0

  for (const row of rows) {
    const doc = Number.isInteger(row?.id) ? owned.get(row.id) : undefined
    if (!doc || !ITEM_STATUSES.has(row?.status)) continue

    // An item with no price can never be imported, so it cannot be selected.
    // Enforced here as well as in the UI, because the UI is not the boundary.
    const status = row.status === 'selected' && row.priceMinor !== null ? 'selected' : 'skipped'
    if (status === 'selected') selected++

    const mapped = (doc.mapped ?? {}) as {
      title?: string
      variants?: { priceMinor?: number }[]
    }
    const titleChanged = typeof row.title === 'string' && row.title.trim() !== '' &&
      row.title !== mapped.title
    const priceChanged =
      typeof row.priceMinor === 'number' && row.priceMinor !== mapped.variants?.[0]?.priceMinor

    if (!titleChanged && !priceChanged) {
      // Nothing but status: batch it.
      ;(status === 'selected' ? selectedIds : skippedIds).push(doc.id)
      continue
    }

    // An edited title or price has to be merged into the stored `mapped`,
    // because that document is exactly what the import phase writes. Dropping
    // the edit here would silently import the source's original values.
    const nextMapped = {
      ...mapped,
      ...(titleChanged ? { title: row.title } : {}),
      ...(priceChanged && Array.isArray(mapped.variants)
        ? {
            variants: mapped.variants.map((v, i) =>
              i === 0 ? { ...v, priceMinor: row.priceMinor } : v,
            ),
          }
        : {}),
    }

    await payload.update({
      collection: 'import-items',
      id: doc.id,
      data: { status, mapped: nextMapped as unknown as Record<string, unknown> },
      overrideAccess: true,
    })
  }

  // Bulk paths for the untouched majority. Each is ANDed with the job id so a
  // crafted body cannot retarget another import; Payload's update takes either
  // an `id` or a `where`, never both, so scoping lives in the query.
  const applyStatus = async (ids: number[], status: 'selected' | 'skipped') => {
    if (ids.length === 0) return
    await payload.update({
      collection: 'import-items',
      where: { and: [{ job: { equals: jobId } }, { id: { in: ids } }] },
      data: { status },
      overrideAccess: true,
    })
  }

  await applyStatus(selectedIds, 'selected')
  await applyStatus(skippedIds, 'skipped')

  await payload.update({
    collection: 'import-jobs',
    id: jobId,
    data: {
      status: 'importing',
      selectedCount: selected,
      priceTaxTreatment: body.priceTaxTreatment,
      ownershipAttestedAt: new Date().toISOString(),
      ownershipAttestedBy: user.id,
    },
    overrideAccess: true,
  })

  return NextResponse.json({ selected })
}
