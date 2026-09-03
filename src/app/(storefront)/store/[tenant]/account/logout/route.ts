import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'

async function handleLogout(req: Request) {
  await clearSessionCookie()
  return NextResponse.redirect(new URL('/', req.url))
}

// POST-only: GET logout is a CSRF vector — a plain link/redirect carries SameSite=Lax cookies
export const POST = handleLogout
