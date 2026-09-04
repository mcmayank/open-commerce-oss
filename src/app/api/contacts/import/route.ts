/**
 * POST /api/contacts/import
 *
 * Authenticated bulk-import of contacts for a tenant.
 *
 * Auth:
 *  - Tenant-admin: tenant is derived from the authenticated user's first admin
 *    tenant. The `tenantId` body field is ignored for non-super-admins.
 *  - Super-admin: must supply `tenantId` in the JSON body (or `?tenantId=` query
 *    param when posting CSV) to indicate which tenant to import into.
 *
 * Body (one of):
 *  - Content-Type: application/json → `{ tenantId?: string|number, contacts: [{ email, name? }] }`
 *  - Content-Type: text/csv or text/plain → CSV text with optional header row;
 *    super-admin must pass `?tenantId=xxx` as a query param.
 *
 * Response: `{ added: number, skipped: number, truncated: boolean }`
 *
 * Security:
 *  - tenantId is ALWAYS derived from the authenticated user (not trusting user-
 *    supplied `tenantId` for non-super-admins).
 *  - Super-admin supplying a `tenantId` is fine — they have global access.
 *  - Rows exceeding 5 000 are truncated; `truncated: true` is included in response.
 */

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'
import { upsertContact } from '@/lib/marketing/contacts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ROWS = 5000

// ── CSV parser ───────────────────────────────────────────────────────────────

interface ContactRow {
  email: string
  name?: string
}

function parseCSV(text: string): ContactRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  // Detect header row — if first row contains the word "email" (case-insensitive)
  const firstCols = lines[0].split(',').map((c) => c.trim().toLowerCase())
  const hasHeader = firstCols.includes('email')
  // TODO: RFC-4180 quoted fields (embedded commas in a quoted name) are not handled; email column is unaffected.

  let emailCol = 0
  let nameCol = -1
  let startIdx = 0

  if (hasHeader) {
    emailCol = firstCols.indexOf('email')
    nameCol = firstCols.indexOf('name')
    startIdx = 1
  }

  return lines.slice(startIdx).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const email = cols[emailCol] ?? ''
    const name = nameCol >= 0 ? (cols[nameCol] ?? '').replace(/^["']|["']$/g, '') || undefined : undefined
    return { email: email.replace(/^["']|["']$/g, ''), name }
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })

  // ── 1. Authenticate via Payload's auth mechanism ──────────────────────────
  let user: (TenantsArrayUser & { id: number | string }) | null = null
  try {
    const result = await payload.auth({ headers: request.headers })
    user = result.user as (TenantsArrayUser & { id: number | string }) | null
  } catch {
    // auth throws if configuration error; treat as unauthenticated
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const superAdmin = isSuperAdmin(user)

  // ── 2. Determine tenantId ─────────────────────────────────────────────────
  let tenantId: string | number | null = null

  if (!superAdmin) {
    // Derive tenantId from the authenticated user's admin tenants.
    // We pick their first admin tenant; a user with multiple admin tenants
    // should use the super-admin route to target a specific tenant.
    const adminIds = getUserTenantIDs(user, 'tenant-admin')
    if (adminIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: no tenant-admin role' },
        { status: 403 },
      )
    }
    tenantId = adminIds[0]
  }
  // Super-admin: tenantId will be read from the request body / query param below.

  // ── 3. Parse request body ────────────────────────────────────────────────
  const contentType = request.headers.get('content-type') ?? ''
  let rows: ContactRow[] = []

  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    // CSV body — super-admin must pass tenantId as query param
    if (superAdmin) {
      const url = new URL(request.url)
      const qp = url.searchParams.get('tenantId')
      if (!qp) {
        return NextResponse.json(
          { ok: false, error: 'Super-admin must supply ?tenantId=<id> when posting CSV' },
          { status: 400 },
        )
      }
      tenantId = qp
    }
    const text = await request.text()
    rows = parseCSV(text)
  } else {
    // JSON body
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    if (superAdmin) {
      const tid = body.tenantId
      if (!tid) {
        return NextResponse.json(
          { ok: false, error: 'Super-admin must supply tenantId in the JSON body' },
          { status: 400 },
        )
      }
      tenantId = tid as string | number
    }

    if (!Array.isArray(body.contacts)) {
      return NextResponse.json(
        { ok: false, error: 'Expected { contacts: [{ email, name? }] }' },
        { status: 400 },
      )
    }
    rows = body.contacts as ContactRow[]
  }

  if (!tenantId) {
    // Should be unreachable given the logic above, but guard defensively
    return NextResponse.json({ ok: false, error: 'Could not determine tenant' }, { status: 400 })
  }

  // ── 4. Cap batch size ────────────────────────────────────────────────────
  let truncated = false
  if (rows.length > MAX_ROWS) {
    rows = rows.slice(0, MAX_ROWS)
    truncated = true
  }

  // ── 5. Upsert each valid contact ─────────────────────────────────────────
  let added = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = typeof row.email === 'string' ? row.email.trim() : ''
    if (!email || !EMAIL_RE.test(email)) {
      skipped++
      continue
    }
    const name = typeof row.name === 'string' ? row.name.trim() || undefined : undefined

    try {
      await upsertContact(tenantId, { email, name, source: 'import' })
      added++
    } catch (err) {
      console.error('[import] row upsertContact failed (index %d):', i, err)
      skipped++
    }
  }

  return NextResponse.json({ ok: true, added, skipped, truncated })
}
