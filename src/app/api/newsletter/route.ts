import { NextRequest, NextResponse } from 'next/server'
import { storeForHost } from '@/store-loader'
import { upsertContact } from '@/lib/marketing/contacts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/newsletter
 *
 * Accepts { email } as either application/json or application/x-www-form-urlencoded.
 * Validates email format, resolves tenant from HOST (never from form data),
 * and persists the subscriber to the contacts collection.
 *
 * Returns 400 if the host does not resolve to an active tenant store.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Resolve tenant from host — NEVER from form data ───────────────────
  const resolved = await storeForHost(request.headers)
  const store = resolved?.status === 'active' ? resolved : null
  if (!store) {
    return NextResponse.json({ ok: false, error: 'Store not found' }, { status: 400 })
  }

  // ── 2. Parse email from request body ─────────────────────────────────────
  let email: string | undefined

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      email = typeof body?.email === 'string' ? body.email.trim() : undefined
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
  } else {
    // application/x-www-form-urlencoded (default for plain HTML forms)
    const formData = await request.formData()
    const raw = formData.get('email')
    email = typeof raw === 'string' ? raw.trim() : undefined
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email address' }, { status: 400 })
  }

  // ── 3. Persist to contacts (idempotent — won't resurrect unsubscribed) ───
  await upsertContact(store.id, { email, source: 'newsletter' })

  return NextResponse.json({ ok: true })
}
