import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { entitlementsForHost } from '@/entitlements'

/**
 * The current store's entitlements, for admin client components that cannot
 * call the server-side resolver (e.g. ProductQuotaNotice). Requires an admin
 * session; answers 404 when the host resolves to no store. `Infinity` caps are
 * sent as `null` because JSON has no Infinity — clients treat null as unlimited.
 */
export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ent = await entitlementsForHost(payload, req.headers.get('host'))
  if (!ent) return NextResponse.json({ error: 'No store for this host' }, { status: 404 })

  return NextResponse.json({
    ...ent,
    maxProducts: Number.isFinite(ent.maxProducts) ? ent.maxProducts : null,
    maxStorageBytes: Number.isFinite(ent.maxStorageBytes) ? ent.maxStorageBytes : null,
  })
}
