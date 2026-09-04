import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export type CronAuthResult = { ok: true } | { ok: false; status: 401; error: string }

/**
 * Cron auth shared by scheduled endpoints. Accepts any ONE of (timing-safe):
 *  - `x-cron-secret: <CRON_SECRET>`
 *  - `Authorization: Bearer <CRON_SECRET>` (Vercel auto-injects on Pro/Enterprise)
 *  - `?secret=<CRON_SECRET>`
 * Denies when CRON_SECRET is unset (never an open endpoint).
 */
export function verifyCronAuth(req: NextRequest): CronAuthResult {
  const expected = process.env.CRON_SECRET
  if (!expected) return { ok: false, status: 401, error: 'CRON_SECRET not configured' }

  const headerSecret = req.headers.get('x-cron-secret')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const provided = headerSecret ?? querySecret ?? bearerSecret

  const authorized = (() => {
    if (!provided || provided.length !== expected.length) return false
    try {
      return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    } catch {
      return false
    }
  })()

  return authorized ? { ok: true } : { ok: false, status: 401, error: 'Unauthorized' }
}
