/**
 * POST /api/export
 *
 * Download this store's catalog, orders and customers as CSVs in one zip.
 *
 * Auth: authenticated tenant-admin of the tenant the request HOST resolves to
 * (or super-admin), exactly as `/api/samples/seed` does. The tenant is never
 * taken from the body — a client cannot export someone else's store.
 *
 * NO PLAN GATE, DELIBERATELY. `/open-source` promises this "on demand from any
 * plan including Free", and gating a merchant's own data behind a subscription
 * is the hostage lock-in the brand principles rule out. If you are here to add
 * an entitlement check, read `docs/superpowers/specs/2026-08-03-data-export-design.md`
 * first.
 */
export const dynamic = 'force-dynamic'
// Six CSVs over four collections, paginated at 500. Wall-clock, not memory, is
// the constraint: 50k orders is roughly 15MB of CSV. Matches /api/samples/seed.
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import type { TenantsArrayUser } from '@/access/roles'
import { storeForHost } from '@/store-loader'
import { canExport } from '@/lib/export/auth'
import { collectExportData, buildExportFiles } from '@/lib/export/collect'
import { requestOrigin } from '@/lib/export/origin'
import { buildZip } from '@/lib/export/zip'

/** `2026-08-03` in UTC, for the archive filename. */
function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })

  const store = await storeForHost(request.headers)
  if (!store) {
    return NextResponse.json({ error: 'No store for this address.' }, { status: 404 })
  }

  let user: TenantsArrayUser | null = null
  try {
    const result = await payload.auth({ headers: request.headers })
    user = result.user as TenantsArrayUser | null
  } catch {
    /* treat as unauthenticated */
  }
  if (!canExport(user, store.id)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  // Assembled in full before a byte is sent. Streaming would let a failure
  // halfway through deliver a truncated archive that still opens, and a
  // partial export presented as a complete one is worse than a failed request.
  const data = await collectExportData(payload, store.id)
  const files = buildExportFiles(data, requestOrigin(request.headers, request.headers.get('host')))
  const zip = buildZip(
    files.map((f) => ({ name: f.name, data: new TextEncoder().encode(f.content) })),
  )

  const filename = `niblr-export-${store.slug}-${isoDay(new Date())}.zip`
  return new NextResponse(zip, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'no-store',
    },
  })
}
