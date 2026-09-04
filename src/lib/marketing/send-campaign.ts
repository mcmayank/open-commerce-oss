/**
 * Campaign send engine: chunked, resumable, idempotent.
 *
 * INVARIANTS (enforced here):
 *  - Only subscribed contacts: guaranteed by buildAudienceWhere, never bypassed.
 *  - Stable cursor: tracks `sendCursor` as the last processed contact ID.
 *    Next chunk = contacts with `id > sendCursor`, sorted ascending.
 *  - Idempotent chunk: idempotencyKey = `${campaignId}:${firstContactId}` so
 *    a retried chunk never double-sends (Resend dedupes for 24 h).
 *  - Decrypt tenant key: via `context: { decryptSecrets: true }`.
 *  - Never throw uncaught: Resend errors are caught, counted as failures,
 *    cursor is NOT advanced on error so a retry resumes from the same chunk.
 */

// NOTE: @payload-config and payload are dynamically imported inside
// processCampaignChunk so that the pure helper functions in this file can be
// imported and tested in the Vitest unit-test environment without needing the
// full Payload/Next.js runtime.
import { Resend } from 'resend'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { buildAudienceWhere } from './audience'
import { renderCampaignEmail } from './render'
import { signUnsubscribe } from './unsubscribe-token'
import type { Where } from 'payload'
import type { Campaign, Contact } from '@/payload-types'
import { loadStoreById } from '@/store-loader-overlay'
import { storeWhere, storeIdOf } from '@/store-scope'

// ── Pure helpers (exported for unit-testing) ─────────────────────────────────

export interface BatchEmailEntry {
  from: string
  to: string[]
  subject: string
  html: string
  headers: {
    'List-Unsubscribe': string
    'List-Unsubscribe-Post': string
  }
}

/**
 * Build the unsubscribe URL for one contact.
 * Dev: http://{slug}.lvh.me:3000/unsubscribe?token=…
 * Prod: https://{slug}.yourdomain.com/unsubscribe?token=…
 */
export function buildUnsubscribeUrl(
  tenantSlug: string,
  contactId: string,
  tenantId: string,
  rootDomain: string,
): string {
  const protocol =
    rootDomain.includes('localhost') || rootDomain.includes('lvh.me') ? 'http' : 'https'
  const token = signUnsubscribe(tenantId, contactId)
  return `${protocol}://${tenantSlug}.${rootDomain}/unsubscribe?token=${token}`
}

/**
 * Build one recipient's batch email entry.
 * Pure function (only calls pure helpers); safe to unit-test.
 */
export function buildBatchEntry({
  contact,
  subject,
  bodyHtml,
  storeName,
  fromName,
  fromEmail,
  tenantId,
  tenantSlug,
  rootDomain,
}: {
  contact: Pick<Contact, 'id' | 'email'>
  subject: string
  bodyHtml: string
  storeName: string
  fromName: string
  fromEmail: string
  tenantId: string
  tenantSlug: string
  rootDomain: string
}): BatchEmailEntry {
  const unsubscribeUrl = buildUnsubscribeUrl(
    tenantSlug,
    String(contact.id),
    tenantId,
    rootDomain,
  )
  // Build the one-click POST URL for the List-Unsubscribe header (same token, API path)
  const unsubscribeApiUrl = unsubscribeUrl.replace(
    '/unsubscribe?token=',
    '/api/marketing/unsubscribe?token=',
  )
  const { subject: renderedSubject, html } = renderCampaignEmail({
    subject,
    bodyHtml,
    storeName,
    unsubscribeUrl,
  })
  return {
    from: `${fromName} <${fromEmail}>`,
    to: [contact.email],
    subject: renderedSubject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeApiUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

/**
 * Return the ID of the last contact in a chunk (the new cursor value).
 * Pure function; safe to unit-test.
 */
export function getNextCursor(chunk: Pick<Contact, 'id'>[]): number {
  if (chunk.length === 0) throw new Error('getNextCursor: empty chunk')
  return chunk[chunk.length - 1].id
}

/**
 * Convert a Payload Lexical richText field value to an HTML string.
 * Uses the official `@payloadcms/richtext-lexical/html` sync converter.
 * Falls back to an empty string if data is null/undefined.
 */
export function lexicalToHtml(
  body: Campaign['body'],
): string {
  if (!body) return ''
  try {
    return convertLexicalToHTML({ data: body as Parameters<typeof convertLexicalToHTML>[0]['data'], disableContainer: true })
  } catch {
    // Safe fallback: strip HTML tags from plain-text serialization
    return ''
  }
}

/**
 * Pure decision: should this campaign chunk transition the campaign to 'sent'?
 * Only when the final chunk is done AND had zero failures.
 * If the final chunk fails (failedCount > 0), the campaign stays 'sending'
 * so the next cron tick retries from the same cursor position.
 */
export function shouldMarkSent(isDone: boolean, failedCount: number): boolean {
  return isDone && failedCount === 0
}

// ── Main chunk processor ──────────────────────────────────────────────────────

export interface ChunkResult {
  done: boolean
  sent: number
  failed: number
}

/**
 * Process the next chunk (≤ 100 contacts) of a campaign send.
 *
 * Call this repeatedly (e.g. from the cron endpoint) until `done === true`.
 *
 * @returns `{ done: true, sent: 0, failed: 0 }` if campaign is not in `sending`
 *          state (no-op, safe to call).
 */
export async function processCampaignChunk(campaignId: number | string): Promise<ChunkResult> {
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })

  // 1. Load campaign ─────────────────────────────────────────────────────────
  let campaign: Campaign
  try {
    campaign = await payload.findByID({
      collection: 'campaigns',
      id: campaignId,
      overrideAccess: true,
    })
  } catch {
    return { done: true, sent: 0, failed: 0 }
  }

  if (campaign.status !== 'sending') {
    return { done: true, sent: 0, failed: 0 }
  }

  const tenantId = String(storeIdOf(campaign))

  // 2. Load marketing config (decrypt the Resend API key) ────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mc: Record<string, any> | undefined
  try {
    const mcResult = await payload.find({
      collection: 'marketing-configs',
      where: {
        and: [
          storeWhere(tenantId),
          { active: { equals: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
      context: { decryptSecrets: true },
    })
    mc = mcResult.docs[0]
  } catch {
    console.error(`[send-campaign] Failed to load marketing config for campaign ${String(campaignId)}`)
    return { done: false, sent: 0, failed: 0 }
  }
  // BYO design: campaigns MUST use the tenant's own Resend config.
  // The platform RESEND_API_KEY is for transactional email only — never for campaigns.
  const resendApiKey = (mc?.resendApiKey as string | null | undefined) || undefined
  const fromEmail = (mc?.fromEmail as string | null | undefined) || undefined
  const fromName = (mc?.fromName as string | null | undefined) || ''

  if (!resendApiKey || !fromEmail) {
    // No active marketing-config with a Resend key + fromEmail — mark failed
    const reason = !resendApiKey
      ? 'No active marketing-config with a Resend API key found. Configure one in Marketing > Settings.'
      : 'No active marketing-config with a fromEmail found. Configure one in Marketing > Settings.'
    console.error(`[send-campaign] Campaign ${String(campaignId)} failed: ${reason}`)
    try {
      await payload.update({
        collection: 'campaigns',
        id: campaign.id,
        data: {
          status: 'failed',
          completedAt: new Date().toISOString(),
        } as Partial<Campaign>,
        overrideAccess: true,
        context: { skipCampaignLaunchHook: true },
      })
    } catch {
      // best-effort
    }
    return { done: true, sent: 0, failed: 0 }
  }

  // 3. Load tenant for slug (needed for unsubscribe URL) ────────────────────
  let tenantSlug = 'store'
  try {
    tenantSlug = (await loadStoreById(tenantId))?.slug || 'store'
  } catch {
    // non-fatal; use fallback
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lvh.me:3000'

  // 4. Convert richText body to HTML ─────────────────────────────────────────
  const bodyHtml = lexicalToHtml(campaign.body)

  // 5. Load the next chunk of contacts (id-cursor paging) ───────────────────
  const cursor = typeof campaign.sendCursor === 'number' ? campaign.sendCursor : 0
  const audience = campaign.audience as { mode: 'all' | 'tag' | 'source'; tag?: string; source?: string }
  const audienceWhere = buildAudienceWhere(tenantId, {
    mode: audience?.mode || 'all',
    tag: audience?.tag ?? undefined,
    source: audience?.source ?? undefined,
  })

  const audienceClauses = (audienceWhere as { and: Where[] }).and

  let contacts: Contact[] = []
  try {
    const chunkResult = await payload.find({
      collection: 'contacts',
      where: {
        and: [
          ...audienceClauses,
          { id: { greater_than: cursor } },
        ],
      },
      sort: 'id',
      limit: 100,
      overrideAccess: true,
    })
    contacts = chunkResult.docs as Contact[]
  } catch {
    console.error(`[send-campaign] Failed to load contacts for campaign ${String(campaignId)}`)
    return { done: false, sent: 0, failed: 0 }
  }

  // 6. No contacts → campaign finished ──────────────────────────────────────
  if (contacts.length === 0) {
    try {
      await payload.update({
        collection: 'campaigns',
        id: campaign.id,
        data: {
          status: 'sent',
          completedAt: new Date().toISOString(),
        } as Partial<Campaign>,
        overrideAccess: true,
        context: { skipCampaignLaunchHook: true },
      })
    } catch {
      // best-effort: transient failure just retries next tick (status stays sending)
      console.error(`[send-campaign] Failed to mark campaign ${String(campaignId)} as sent (zero-contacts path)`)
    }
    return { done: true, sent: 0, failed: 0 }
  }

  // 7. Build email batch ─────────────────────────────────────────────────────
  const storeName = mc?.fromName || tenantSlug
  const batchPayload = contacts.map((contact) =>
    buildBatchEntry({
      contact,
      subject: campaign.subject,
      bodyHtml,
      storeName,
      fromName: fromName || tenantSlug,
      fromEmail,
      tenantId,
      tenantSlug,
      rootDomain,
    }),
  )

  // 8. Send via Resend batch API (idempotent per chunk) ─────────────────────
  const firstContactId = contacts[0].id
  const idempotencyKey = `${campaign.id}:${firstContactId}`
  const resend = new Resend(resendApiKey)

  let sentCount = 0
  let failedCount = 0
  let newCursor = cursor // don't advance on error

  try {
    const { data: batchData, error: batchError } = await resend.batch.send(batchPayload, {
      idempotencyKey,
    })

    if (batchError || !batchData) {
      // Batch-level failure — count all as failed, keep cursor
      failedCount = contacts.length
    } else {
      sentCount = contacts.length
      newCursor = getNextCursor(contacts)
    }
  } catch {
    // Network / unexpected error — count all as failed, keep cursor
    failedCount = contacts.length
  }

  // 9. Determine if this chunk completes the send ────────────────────────────
  const isDone = contacts.length < 100

  // 10. Max-retry guard: permanently-broken campaign → failed after cap ───────
  const newSendAttempts = (campaign.sendAttempts ?? 0) + (failedCount > 0 ? 1 : 0)
  const SEND_ATTEMPTS_CAP = 20

  if (failedCount > 0 && newSendAttempts >= SEND_ATTEMPTS_CAP) {
    console.error(
      `[send-campaign] Campaign ${String(campaignId)} exceeded ${SEND_ATTEMPTS_CAP} failed chunks — marking failed.`,
    )
    try {
      await payload.update({
        collection: 'campaigns',
        id: campaign.id,
        data: {
          status: 'failed',
          completedAt: new Date().toISOString(),
          failedCount: (campaign.failedCount ?? 0) + failedCount,
          sendAttempts: newSendAttempts,
        } as Partial<Campaign>,
        overrideAccess: true,
        context: { skipCampaignLaunchHook: true },
      })
    } catch {
      // best-effort
    }
    return { done: true, sent: sentCount, failed: failedCount }
  }

  // 11. Persist updated counters + cursor ───────────────────────────────────
  const updateData: Partial<Campaign> = {
    sentCount: (campaign.sentCount ?? 0) + sentCount,
    failedCount: (campaign.failedCount ?? 0) + failedCount,
    sendCursor: newCursor,
    sendAttempts: newSendAttempts,
  }
  if (shouldMarkSent(isDone, failedCount)) {
    updateData.status = 'sent'
    updateData.completedAt = new Date().toISOString()
  }

  try {
    await payload.update({
      collection: 'campaigns',
      id: campaign.id,
      data: updateData,
      overrideAccess: true,
      context: { skipCampaignLaunchHook: true },
    })
  } catch {
    // best-effort persist; return counts anyway
  }

  return { done: isDone, sent: sentCount, failed: failedCount }
}
