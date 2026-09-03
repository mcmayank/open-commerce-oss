import { NextResponse } from 'next/server'

/**
 * Clears the Payload admin session (`payload-token`) and returns to the admin
 * login on the same host.
 *
 * Reachable from anywhere: `/admin*` paths are excluded from the tenant proxy
 * rewrite, and this is a plain route handler — not inside the admin UI's
 * HostBinding gate — so it works even from the "No access to this store's admin"
 * screen, where the Payload admin chrome (and its built-in logout) never render.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const host = request.headers.get('host') ?? ''
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https')

  const res = NextResponse.redirect(`${proto}://${host}/admin`, { status: 303 })
  // Payload's default session cookie (no cookiePrefix configured → `payload-token`).
  res.cookies.delete('payload-token')
  return res
}
