/**
 * Deliver minted gift-card codes to their recipient.
 *
 * This is the ONLY place a plaintext gift-card code is ever shown after
 * issuance — it exists nowhere else (not in the admin UI, not in a log line,
 * not in an API response). `issueGiftCardsForOrder` (`./issue.ts`) hands the
 * plaintext codes to its caller exactly once, for whichever call actually
 * minted them; everything downstream of that must treat the code as
 * write-only and never log it.
 *
 * Follows `src/lib/email.ts`'s conventions: no shared client, a fresh
 * `new Resend(apiKey)` per send, `platformFrom()` for the sender, a no-op
 * (logged) skip when `RESEND_API_KEY` is unset, and every exported sender
 * NEVER throws — a delivery failure must not roll back a paid order or an
 * already-minted card.
 */
import type { Payload } from 'payload'
import { Resend } from 'resend'
import { formatMoney } from '@/lib/money'
import { platformFrom } from '@/lib/email'
import { storeWhere } from '@/store-scope'
import { loadStoreById } from '@/store-loader-overlay'
import { storeOrigin } from '@/store-origin-overlay'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000'

function escapeHtml(s: unknown): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c] ?? c,
  )
}

/**
 * `formatMoney` renders via `Intl.NumberFormat`, which joins the currency
 * code to the amount with U+00A0 (NBSP), not a plain space. That is correct
 * for on-screen rendering but reads as a stray invisible character in a
 * plaintext email — normalize to a regular space for both `text` and `html`.
 */
function formatAmount(amountMinor: number, currency: string): string {
  return formatMoney(amountMinor, currency).replace(/ /g, ' ')
}

export interface GiftCardEmailCard {
  code: string
  amountMinor: number
}

export interface RenderGiftCardEmailArgs {
  storeName: string
  storeUrl: string
  recipientName?: string | null
  message?: string | null
  currency: string
  cards: GiftCardEmailCard[]
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * Pure. Renders the subject/html/text for a gift-card delivery email. No IO,
 * no logging — safe to unit test directly (see `email.test.ts`) and safe to
 * call speculatively, since it never touches the network or a database.
 *
 * `recipientName` and `message` are shopper-supplied free text (set at
 * checkout), so both are HTML-escaped before interpolation — unlike
 * `storeName`/`storeUrl`, which come from the merchant's own settings.
 */
export function renderGiftCardEmail(args: RenderGiftCardEmailArgs): RenderedEmail {
  const { storeName, storeUrl, recipientName, message, currency, cards } = args
  const plural = cards.length > 1
  const safeStoreName = escapeHtml(storeName)
  const safeStoreUrl = escapeHtml(storeUrl)
  const safeRecipientName = recipientName ? escapeHtml(recipientName) : null
  const safeMessage = message ? escapeHtml(message) : null

  const subject = plural
    ? `You've received ${cards.length} gift cards from ${storeName}`
    : `You've received a gift card from ${storeName}`

  const cardsHtml = cards
    .map(
      (c) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e8ec;border-radius:10px;margin:0 0 12px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-size:12px;color:#5b6169;text-transform:uppercase;letter-spacing:.04em;">Gift card value</div>
              <div style="font-size:22px;font-weight:700;color:#171717;margin:2px 0 10px;">${escapeHtml(formatAmount(c.amountMinor, currency))}</div>
              <div style="font-size:12px;color:#5b6169;text-transform:uppercase;letter-spacing:.04em;">Code</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:18px;letter-spacing:1px;color:#171717;font-weight:700;">${escapeHtml(c.code)}</div>
            </td>
          </tr>
        </table>`,
    )
    .join('')

  const messageHtml = safeMessage
    ? `<p style="font-size:15px;color:#374151;font-style:italic;border-left:3px solid #e6e8ec;padding:0 0 0 12px;margin:0 0 20px;">&ldquo;${safeMessage}&rdquo;</p>`
    : ''

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#171717;">
      <p style="font-size:16px;margin:0 0 12px;">${safeRecipientName ? `Hi ${safeRecipientName},` : 'Hi,'}</p>
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">${safeStoreName} sent you ${plural ? 'these gift cards' : 'a gift card'}.</p>
      ${messageHtml}
      ${cardsHtml}
      <p style="font-size:13px;color:#5b6169;margin:16px 0 0;">Enter ${plural ? 'a code' : 'the code'} at checkout on <a href="${safeStoreUrl}" style="color:#171717;">${safeStoreUrl}</a> to redeem ${plural ? 'its balance' : 'the balance'}.</p>
    </div>
  `.trim()

  const cardsText = cards.map((c) => `${formatAmount(c.amountMinor, currency)} — code: ${c.code}`).join('\n')

  const text = [
    recipientName ? `Hi ${recipientName},` : 'Hi,',
    '',
    `${storeName} sent you ${plural ? 'these gift cards' : 'a gift card'}.`,
    '',
    ...(message ? [`"${message}"`, ''] : []),
    cardsText,
    '',
    `Redeem at checkout: ${storeUrl}`,
  ].join('\n')

  return { subject, html, text }
}

/**
 * Send a gift-card delivery email to `to`. No-ops (logged) when
 * `RESEND_API_KEY` is unset — dev/test mode, same as every other sender in
 * `src/lib/email.ts`. NEVER throws: catches and logs any send failure so a
 * caller can never have a paid order or a minted card undone by a delivery
 * problem.
 *
 * Never logs `to`, the rendered body, or any card's code — only a card count,
 * matching the "plaintext code appears in this email and nowhere else" rule.
 */
export async function sendGiftCardEmail(to: string, args: RenderGiftCardEmailArgs): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log('[email] gift card delivery —', args.cards.length, 'card(s) (RESEND_API_KEY not set — skipping)')
      return
    }
    const { subject, html } = renderGiftCardEmail(args)
    await new Resend(apiKey).emails.send({ from: platformFrom(), to, subject, html })
  } catch (err) {
    console.error('[email] sendGiftCardEmail failed:', err)
  }
}

/**
 * Absolute storefront URL for a store, used as the "redeem at" link in the
 * delivery email. Goes through the store-origin seam (pure, no request) because
 * this runs from webhook reconciliation and cron sweeps, neither of which has a
 * live Next.js request: hosted answers the platform subdomain, the single-store
 * build its own domain.
 */
function resolveStoreUrl(slug: string): string {
  return storeOrigin(slug)
}

export interface SendGiftCardEmailForOrderArgs {
  tenantId: string | number
  orderId: string | number
  currency: string
  cards: GiftCardEmailCard[]
  recipientEmail?: string | null
  recipientName?: string | null
  message?: string | null
}

/**
 * Order-level convenience wrapper around `sendGiftCardEmail`, shared by every
 * place that mints gift cards: `payment-event-handler`'s normal paid path AND
 * its `already_paid` webhook-redelivery self-heal, `sweepStuckGiftCardIssuance`
 * (the daily repair cron), and `startCheckout`'s zero-cover-by-gift-card path
 * (which marks an order paid directly and mints inline — no webhook ever
 * fires for that order, so `payment-event-handler` never gets a chance to
 * send this).
 *
 * All four call `issueGiftCardsForOrder`, which is idempotent: it returns the
 * plaintext codes ONLY for cards minted by that specific call, and every
 * other call — including a self-heal or a sweep pass that finds the order
 * already fully minted — gets back `[]`. Gating this function on
 * `cards.length > 0` is therefore sufficient by itself to guarantee a card is
 * emailed exactly once, no matter which of the four call sites happened to be
 * the one that actually minted it. No separate "already emailed" flag is
 * needed.
 *
 * No-ops (no lookups, no send) when there is nothing to deliver or no address
 * to deliver it to. Never throws — every failure (including resolving the
 * store's name/URL) is caught and logged with counts and the order id only,
 * never the recipient address, the rendered body, or a code.
 */
export async function sendGiftCardEmailForOrder(
  payload: Payload,
  args: SendGiftCardEmailForOrderArgs,
): Promise<void> {
  const { tenantId, orderId, currency, cards, recipientEmail, recipientName, message } = args
  if (cards.length === 0 || !recipientEmail) return

  try {
    const [tenant, settings] = await Promise.all([
      loadStoreById(tenantId).catch(() => null),
      payload
        .find({
          collection: 'store-settings',
          where: storeWhere(tenantId),
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs[0] ?? null)
        .catch(() => null),
    ])

    const storeName = (settings as { storeName?: string } | null)?.storeName ?? tenant?.name ?? 'Store'
    const slug = tenant?.slug ?? ''
    const storeUrl = resolveStoreUrl(slug)

    await sendGiftCardEmail(recipientEmail, {
      storeName,
      storeUrl,
      recipientName,
      message,
      currency,
      cards,
    })

    console.log('[email] gift card delivery sent', { order: orderId, cards: cards.length })
  } catch (err) {
    console.error('[email] gift card delivery failed', { order: orderId, cards: cards.length }, err)
  }
}
