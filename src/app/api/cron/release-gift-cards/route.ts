/**
 * POST /api/cron/release-gift-cards
 *
 * Cron-callable backstop, two passes, both closing gift-card money-loss gaps
 * that have no other recovery path in the repo:
 *
 *  1. Abandoned reservations. `reverseGiftCardForOrder` only ever runs when a
 *     webhook arrives (reconciliation's not_succeeded branch); a shopper who
 *     opens the gateway's hosted page and closes the tab, on a provider that
 *     emits nothing for a session that merely expires unused, produces no
 *     webhook at all. Without this sweep that reservation is stranded on the
 *     order forever — the order-status route is a passive GET the shopper
 *     has to land on themselves. Finds `pending` orders with a gift-card
 *     reservation older than `ABANDONED_GIFT_CARD_RESERVATION_HOURS` and
 *     releases each one via `sweepAbandonedGiftCardReservations` (see
 *     src/lib/gift-cards/redeem.ts for the window's tradeoff and the
 *     concurrency-safe claim it reuses from `reverseGiftCardForOrder`).
 *
 *  2. Stuck issuance. A PAID order that sells a gift card but never got it
 *     minted — either Task 8's zero-cover checkout path (marks paid inline,
 *     no webhook ever fires for that order, so a mint failure there has no
 *     redelivery to self-heal it) or an ordinary gateway-paid order whose
 *     mint step threw and whose provider never redelivered the webhook.
 *     Finds `paid` orders selling a gift card, paid more than
 *     `STUCK_GIFT_CARD_ISSUANCE_HOURS` ago, and calls `issueGiftCardsForOrder`
 *     — idempotent, mints only the shortfall — via
 *     `sweepStuckGiftCardIssuance`.
 *
 * Auth: see verifyCronAuth in @/lib/auth/cron (same scheme as
 * /api/marketing/process and /api/cron/verify-domains).
 *
 * Schedule: daily (see vercel.json). Both windows above are the
 * fine-grained knobs — a daily sweep just means a stuck reservation or
 * missing card may sit for up to ~24h on top of its own window in the worst
 * case, an acceptable bound for either kind of gap.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/auth/cron'
import { sweepAbandonedGiftCardReservations, sweepStuckGiftCardIssuance } from '@/lib/gift-cards/redeem'

async function handle(req: NextRequest): Promise<NextResponse> {
  const auth = verifyCronAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })

  // The two passes are INDEPENDENT repairs of two different money-loss gaps,
  // so they are isolated from each other rather than awaited in a row. Both
  // sweeps already isolate their own per-order failures, but either can still
  // fail outright at the query — and an unguarded `await` on the first would
  // mean a single bad day for reservations silently skips the issuance repair
  // (shoppers who paid and got no card) every night until someone noticed a
  // 500. Each result is reported on its own; a failure is an `error` string in
  // the response, not a thrown request.
  let reservations: { released: number; scanned: number } | null = null
  let reservationsError: string | null = null
  try {
    reservations = await sweepAbandonedGiftCardReservations(payload)
    // Counts only — never log a gift-card code or order/card identifier here.
    console.log('[cron/release-gift-cards]', reservations)
  } catch (err) {
    reservationsError = err instanceof Error ? err.message : String(err)
    console.error('[cron/release-gift-cards] reservation sweep failed', err)
  }

  let issuance: { scanned: number; minted: number } | null = null
  let issuanceError: string | null = null
  try {
    issuance = await sweepStuckGiftCardIssuance(payload)
    // Same rule: a count of cards minted, never a code.
    console.log('[cron/release-gift-cards] issuance repair', issuance)
  } catch (err) {
    issuanceError = err instanceof Error ? err.message : String(err)
    console.error('[cron/release-gift-cards] issuance sweep failed', err)
  }

  // 500 only when BOTH passes failed: a half-successful run still did real
  // repair work, and reporting it as a total failure would hide that.
  const ok = reservationsError === null || issuanceError === null

  return NextResponse.json(
    {
      ok,
      scanned: reservations?.scanned ?? 0,
      released: reservations?.released ?? 0,
      issuanceScanned: issuance?.scanned ?? 0,
      minted: issuance?.minted ?? 0,
      ...(reservationsError ? { reservationsError } : {}),
      ...(issuanceError ? { issuanceError } : {}),
    },
    { status: ok ? 200 : 500 },
  )
}

export const GET = handle
export const POST = handle
