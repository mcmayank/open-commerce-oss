import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { buildAudienceWhere } from '@/lib/marketing/audience'
import type { Campaign } from '@/payload-types'
import { storeIdOf } from '@/store-scope'
import { NAV_GROUPS } from './nav-groups'

/**
 * afterChange hook: when a campaign transitions into `sending`, initialise the
 * send-engine fields (totalRecipients, sendCursor, sentCount, failedCount,
 * startedAt) so `processCampaignChunk` has a clean starting state.
 *
 * Recursion guard: the follow-up `payload.update` call passes
 * `context: { skipCampaignLaunchHook: true }` and we bail immediately when
 * that flag is set — preventing an infinite hook loop.
 */
const campaignLaunchHook: CollectionAfterChangeHook<Campaign> = async ({
  doc,
  previousDoc,
  req,
}) => {
  // Recursion guard ──────────────────────────────────────────────────────────
  if (req.context?.skipCampaignLaunchHook) return doc

  // Only fire on the draft→sending (or scheduled→sending) transition
  if (doc.status !== 'sending' || previousDoc?.status === 'sending') return doc

  const payload = req.payload

  const tenantId = String(storeIdOf(doc))

  // Count total recipients for the campaign's audience
  let totalRecipients = 0
  try {
    const audience = doc.audience as
      | { mode?: 'all' | 'tag' | 'source' | null; tag?: string | null; source?: string | null }
      | undefined

    const audienceWhere = buildAudienceWhere(tenantId, {
      mode: audience?.mode ?? 'all',
      tag: audience?.tag ?? undefined,
      source: audience?.source ?? undefined,
    })

    const countResult = await payload.count({
      collection: 'contacts',
      where: audienceWhere,
      overrideAccess: true,
    })
    totalRecipients = countResult.totalDocs
  } catch {
    // non-fatal — totalRecipients stays 0
  }

  // Persist initial send-engine state (skip this hook on the follow-up save)
  try {
    await payload.update({
      collection: 'campaigns',
      id: doc.id,
      data: {
        totalRecipients,
        sendCursor: 0,
        sentCount: 0,
        failedCount: 0,
        startedAt: new Date().toISOString(),
      } as Partial<Campaign>,
      overrideAccess: true,
      context: { skipCampaignLaunchHook: true },
    })
  } catch {
    // best-effort
  }

  return doc
}

export const Campaigns: CollectionConfig = {
  slug: 'campaigns',
  admin: {
    group: NAV_GROUPS.campaigns,
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'sentCount', 'totalRecipients'],
  },
  hooks: {
    afterChange: [campaignLaunchHook],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
    },
    {
      name: 'audience',
      type: 'group',
      fields: [
        {
          name: 'mode',
          type: 'select',
          defaultValue: 'all',
          options: [
            { label: 'All Subscribers', value: 'all' },
            { label: 'By Tag', value: 'tag' },
            { label: 'By Source', value: 'source' },
          ],
        },
        {
          name: 'tag',
          type: 'text',
          admin: {
            condition: (data) => data?.audience?.mode === 'tag',
          },
        },
        {
          name: 'source',
          type: 'select',
          options: [
            { label: 'Checkout', value: 'checkout' },
            { label: 'Newsletter', value: 'newsletter' },
            { label: 'Import', value: 'import' },
            { label: 'Manual', value: 'manual' },
          ],
          admin: {
            condition: (data) => data?.audience?.mode === 'source',
          },
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Sending', value: 'sending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        description:
          "Set to 'sending' to launch immediately, or set to 'scheduled' and fill in scheduledAt to send later. Counters (totalRecipients, sentCount, failedCount) update automatically — do not edit them directly.",
      },
      // Guard: prevent launching a campaign with an empty audience selector.
      // siblingData includes audience when the full form is submitted (admin UI);
      // partial cron updates ({status:'sending'}) omit audience → validation skips.
      validate: (value: string | null | undefined, { siblingData }: { siblingData?: Record<string, unknown> }) => {
        const launchStatuses: string[] = ['sending', 'scheduled']
        if (!value || !launchStatuses.includes(value)) return true

        const audience = (siblingData as { audience?: { mode?: string | null; tag?: string | null; source?: string | null } } | undefined)?.audience
        if (!audience || !audience.mode) return true

        if (audience.mode === 'tag' && !(audience.tag ?? '').trim()) {
          return 'Cannot launch: audience mode is "By Tag" but no tag is specified. Enter a tag or switch to "All Subscribers".'
        }
        if (audience.mode === 'source' && !audience.source) {
          return 'Cannot launch: audience mode is "By Source" but no source is selected. Select a source or switch to "All Subscribers".'
        }

        return true
      },
    },
    {
      name: 'scheduledAt',
      type: 'date',
    },
    {
      name: 'totalRecipients',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'sentCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'failedCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'sendCursor',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'sendAttempts',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Counts consecutive failed send chunks. Campaign is marked failed after 20.',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
}
