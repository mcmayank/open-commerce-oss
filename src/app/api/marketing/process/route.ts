/**
 * POST /api/marketing/process
 *
 * Cron-callable endpoint that:
 *  1. Promotes due `scheduled` campaigns (scheduledAt ≤ now) to `sending`.
 *  2. Finds all `sending` campaigns across all tenants.
 *  3. Calls `processCampaignChunk` up to 5 times per campaign (bounded to
 *     respect serverless time budgets).
 *
 * Auth: accepts any ONE of (all timing-safe compared against CRON_SECRET env var):
 *  - `Authorization: Bearer <CRON_SECRET>` header  ← Vercel auto-injects this on
 *    Pro/Enterprise when CRON_SECRET is set in project env vars. On Hobby Vercel
 *    sends NO header, so the endpoint 401s silently — upgrade plan or use a query param.
 *  - `x-cron-secret: <CRON_SECRET>` header
 *  - `?secret=<CRON_SECRET>` query param
 *
 * Locally: trigger via
 *   curl -H 'x-cron-secret: <value>' -X POST http://localhost:3000/api/marketing/process
 * or
 *   curl -X POST 'http://localhost:3000/api/marketing/process?secret=<value>'
 */

export const dynamic = 'force-dynamic'
// maxDuration: 60 — set in vercel.json; Next.js route segment config mirrors it:
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { processCampaignChunk } from '@/lib/marketing/send-campaign'
import { verifyCronAuth } from '@/lib/auth/cron'

async function handle(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const auth = verifyCronAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // ── 2. Bootstrap Payload ───────────────────────────────────────────────────
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })

  const now = new Date().toISOString()

  // ── 3. Promote due scheduled campaigns to sending ──────────────────────────
  const scheduledResult = await payload.find({
    collection: 'campaigns',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { scheduledAt: { less_than_equal: now } },
      ],
    },
    limit: 50,
    overrideAccess: true,
  })

  for (const campaign of scheduledResult.docs) {
    try {
      await payload.update({
        collection: 'campaigns',
        id: campaign.id,
        data: { status: 'sending' },
        overrideAccess: true,
        // The afterChange hook will set totalRecipients / sendCursor / startedAt
      })
    } catch (err) {
      console.error(`[marketing/process] Failed to promote campaign ${campaign.id}:`, err)
    }
  }

  // ── 4. Process all sending campaigns (bounded chunks per campaign) ─────────
  const sendingResult = await payload.find({
    collection: 'campaigns',
    where: { status: { equals: 'sending' } },
    limit: 50,
    overrideAccess: true,
  })

  const MAX_CHUNKS_PER_CAMPAIGN = 5
  const processed: Array<{
    campaignId: number
    campaignName: string
    chunks: number
    sent: number
    failed: number
    done: boolean
  }> = []

  for (const campaign of sendingResult.docs) {
    let totalSent = 0
    let totalFailed = 0
    let done = false
    let chunks = 0

    for (let i = 0; i < MAX_CHUNKS_PER_CAMPAIGN; i++) {
      try {
        const result = await processCampaignChunk(campaign.id)
        totalSent += result.sent
        totalFailed += result.failed
        done = result.done
        chunks++
        if (done) break
      } catch (err) {
        console.error(`[marketing/process] Error processing chunk for campaign ${campaign.id}:`, err)
        break
      }
    }

    processed.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      chunks,
      sent: totalSent,
      failed: totalFailed,
      done,
    })
  }

  return NextResponse.json({
    ok: true,
    promoted: scheduledResult.docs.length,
    processed,
  })
}

export const GET = handle
export const POST = handle
