/**
 * POST /api/marketing/unsubscribe?token=<signed-token>
 *
 * Handles two callers:
 *  1. Browser form submission (from /unsubscribe confirm page):
 *     Verifies the token, unsubscribes the contact, then redirects to
 *     the confirm page with ?done=1 so the user sees the success UI.
 *
 *  2. Email client one-click (RFC 8058 List-Unsubscribe-Post):
 *     Mail clients POST to this URL with body `List-Unsubscribe=One-Click`.
 *     We return 200 OK after unsubscribing (no redirect needed).
 *
 * Security — three-layer check (mirrors the page GET verification):
 *  1. HMAC-SHA256 token signature is valid (verifyUnsubscribe).
 *  2. Contact found by contactId from the token.
 *  3. contact.tenant === token.tenantId (defence-in-depth; prevents cross-tenant
 *     unsubscribes even if the token were somehow reused across tenants).
 *
 * URL shape:
 *  Visible email link → GET  https://{slug}.{domain}/unsubscribe?token=…  (confirm page)
 *  List-Unsubscribe  → POST  https://{slug}.{domain}/api/marketing/unsubscribe?token=…  (this route)
 *  Form action       → POST  /api/marketing/unsubscribe?token=…             (relative, same origin)
 *
 * The /api prefix is excluded from the subdomain proxy rewrite (proxy.ts matcher),
 * so this route is reached directly by Next.js regardless of subdomain.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribe } from '@/lib/marketing/unsubscribe-token'
import config from '@payload-config'
import { getPayload } from 'payload'
import type { Contact } from '@/payload-types'
import { storeIdOf } from '@/store-scope'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Extract token ────────────────────────────────────────────────────────
  // Token comes from the query string for both the form action and List-Unsubscribe-Post.
  const token = req.nextUrl.searchParams.get('token') ?? ''

  // Detect RFC 8058 one-click from a mail client:
  // body is application/x-www-form-urlencoded with "List-Unsubscribe=One-Click"
  let isOneClick = false
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      const body = await req.text()
      isOneClick = body.includes('List-Unsubscribe=One-Click')
    }
  } catch {
    // best-effort; treat as browser form if we can't parse
  }

  // ── 2. Verify the signed token ──────────────────────────────────────────────
  const verified = verifyUnsubscribe(token)
  if (!verified) {
    if (isOneClick) return new NextResponse(null, { status: 400 })
    // Browser: redirect back to unsubscribe page to show the error UI
    const host = req.headers.get('host') ?? ''
    const proto = host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https'
    return NextResponse.redirect(`${proto}://${host}/unsubscribe?token=${encodeURIComponent(token)}`)
  }

  const { tenantId, contactId } = verified

  // ── 3. Load contact + perform unsubscribe ───────────────────────────────────
  try {
    const payload = await getPayload({ config })

    const contact = await payload.findByID({
      collection: 'contacts',
      id: Number(contactId),
      overrideAccess: true,
    })

    // Defence-in-depth: contact must belong to the tenant in the token
    const contactTenantId = storeIdOf(contact)

    if (!contact || String(contactTenantId) !== String(tenantId)) {
      // Token/contact mismatch — treat as invalid
      if (isOneClick) return new NextResponse(null, { status: 400 })
      const host = req.headers.get('host') ?? ''
      const proto = host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https'
      return NextResponse.redirect(`${proto}://${host}/unsubscribe?token=${encodeURIComponent(token)}`)
    }

    // Only mutate if not already unsubscribed
    if ((contact as Contact).status !== 'unsubscribed') {
      await payload.update({
        collection: 'contacts',
        id: contact.id,
        data: {
          status: 'unsubscribed',
          unsubscribedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    }
  } catch (err) {
    console.error('[unsubscribe POST] failed to update contact:', err)
    if (isOneClick) return new NextResponse(null, { status: 500 })
    const host = req.headers.get('host') ?? ''
    const proto = host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https'
    return NextResponse.redirect(`${proto}://${host}/unsubscribe?token=${encodeURIComponent(token)}`)
  }

  // ── 4. Respond ──────────────────────────────────────────────────────────────
  if (isOneClick) {
    // RFC 8058: return 200 OK for one-click mail clients
    return new NextResponse(null, { status: 200 })
  }

  // Browser form: redirect to confirm page with done=1 so the success UI renders
  const host = req.headers.get('host') ?? ''
  const proto = host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https'
  return NextResponse.redirect(
    `${proto}://${host}/unsubscribe?token=${encodeURIComponent(token)}&done=1`,
  )
}
