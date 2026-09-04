import { Resend } from 'resend'
import { formatMoney } from '@/lib/money'
import { renderOrderConfirmation, renderInvoice, renderPasswordReset, renderWelcome, renderMagicLink } from '@/emails'
import type { Order } from '@/payload-types'

export const platformFrom = () =>
  process.env.RESEND_FROM_EMAIL ?? 'Niblr <noreply@mail.niblr.store>'

/**
 * Send an order confirmation email to the buyer.
 *
 * If `RESEND_API_KEY` is set, sends a real email via Resend using the
 * platform-level sender address (`RESEND_FROM_EMAIL`).
 * Otherwise, logs a notice to stdout (dev / test mode).
 *
 * NEVER throws — all errors are caught and logged so callers (e.g. the
 * payment webhook handler) are never failed by an email error.
 *
 * Phase 5: swap to per-tenant BYO Resend API keys stored in store-settings.
 */
export async function sendOrderConfirmation(order: Order): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log(
        '[email] order confirmation',
        order.orderNumber ?? `#${order.id}`,
        '→',
        order.email,
        '(RESEND_API_KEY not set — skipping)',
      )
      return
    }
    const html = await renderOrderConfirmation(order)
    await new Resend(apiKey).emails.send({
      from: platformFrom(),
      to: order.email,
      subject: `Order Confirmed — ${order.orderNumber ?? `#${order.id}`}`,
      html,
    })
  } catch (err) {
    // Never propagate — email failures must not fail the webhook handler
    console.error('[email] sendOrderConfirmation failed:', err)
  }
}

/**
 * Email the customer their invoice with the PDF attached.
 * No-ops with a log when RESEND_API_KEY is unset (does not throw).
 *
 * Otherwise propagates send failures to the caller.
 */
export async function sendInvoice(order: Order, pdf: Buffer, storeName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const invoiceNo = order.invoiceNumber ?? 'INV'
  if (!apiKey) {
    console.log(
      `[email] invoice ${invoiceNo} for order ${order.orderNumber} → ${order.email} (RESEND_API_KEY not set — skipping)`,
    )
    return
  }
  const html = await renderInvoice({
    invoiceNo: String(invoiceNo),
    storeName,
    orderNumber: order.orderNumber ?? `#${order.id}`,
    total: formatMoney(order.total, order.currency),
    // Same rule as the PDF: the TRN snapshotted on the order is what makes
    // this a tax invoice.
    isTaxInvoice: Boolean(String(order.supplierTrn ?? '').trim()),
  })
  await new Resend(apiKey).emails.send({
    from: platformFrom(),
    to: order.email,
    subject: `${String(order.supplierTrn ?? '').trim() ? 'Tax invoice' : 'Invoice'} ${invoiceNo} from ${storeName}`,
    html,
    attachments: [{ filename: `invoice-${invoiceNo}.pdf`, content: pdf.toString('base64') }],
  })
}

/**
 * Send a password-reset email containing a single-use reset link.
 *
 * If `RESEND_API_KEY` is set, sends a real email via Resend.
 * Otherwise logs to stdout (dev / test mode).
 *
 * NEVER throws — all errors are caught and logged.
 */
export async function sendPasswordReset(
  to: string,
  resetUrl: string,
  storeName: string,
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log('[email] password reset for', to, '(RESEND_API_KEY not set — skipping)')
      return
    }
    const html = await renderPasswordReset({ resetUrl, storeName })
    await new Resend(apiKey).emails.send({
      from: platformFrom(),
      to,
      subject: `Reset your password — ${storeName}`,
      html,
    })
  } catch (err) {
    // Never propagate — email failures must not block the reset flow
    console.error('[email] sendPasswordReset failed:', err)
  }
}

/**
 * Send a welcome email to a newly onboarded tenant/store.
 *
 * If `RESEND_API_KEY` is set, sends a real email via Resend.
 * Otherwise logs to stdout (dev / test mode).
 *
 * NEVER throws — all errors are caught and logged.
 */
export async function sendWelcome({
  to,
  storeName,
  slug,
}: {
  to: string
  storeName: string
  slug: string
}): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log('[email] welcome for', to, `(store ${slug})`, '(RESEND_API_KEY not set — skipping)')
      return
    }
    const html = await renderWelcome({ storeName, slug })
    await new Resend(apiKey).emails.send({
      from: platformFrom(),
      to,
      subject: `Welcome to Niblr — ${storeName}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendWelcome failed:', err)
  }
}

/**
 * Compose the internal "new store signed up" operator alert. Pure — no IO — so
 * the subject/body wiring is unit-tested; the thin IO wrapper below reads env
 * and sends. Intentionally inline HTML (internal ops email, not customer-facing).
 */
export function composeNewStoreAlert(input: {
  storeName: string
  slug: string
  ownerEmail: string
  planLabel: string
  storeUrl: string
  adminUrl: string
}): { subject: string; html: string; replyTo: string } {
  const { storeName, slug, ownerEmail, planLabel, storeUrl, adminUrl } = input
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin: 0 0 4px;">🎉 New store signed up</h2>
      <p style="margin: 0 0 16px; color: #666;">Someone just created a store on Niblr.</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #888;">Store</td><td style="padding: 6px 0; font-weight: 600;">${storeName}</td></tr>
        <tr><td style="padding: 6px 0; color: #888;">URL</td><td style="padding: 6px 0;"><a href="${storeUrl}">${storeUrl}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #888;">Owner</td><td style="padding: 6px 0;"><a href="mailto:${ownerEmail}">${ownerEmail}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #888;">Plan picked</td><td style="padding: 6px 0;">${planLabel}</td></tr>
      </table>
      <p style="margin: 20px 0 0;"><a href="${adminUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 14px;">View in admin</a></p>
    </div>`
  return { subject: `🎉 New store: ${storeName} (${slug})`, replyTo: ownerEmail, html }
}

/**
 * Notify the platform operator (PLATFORM_NOTIFICATION_EMAIL) that a new store was
 * created in the signup flow. No-ops with a log when RESEND_API_KEY or
 * PLATFORM_NOTIFICATION_EMAIL is unset — so local dev and self-host never error or
 * ping an operator inbox. NEVER throws — signup must not fail on an alert.
 */
export async function sendNewStoreAlert({
  storeName,
  slug,
  ownerEmail,
  planLabel,
  tenantId,
}: {
  storeName: string
  slug: string
  ownerEmail: string
  planLabel: string
  tenantId: string | number
}): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const to = process.env.PLATFORM_NOTIFICATION_EMAIL
    if (!apiKey || !to) {
      console.log('[email] new-store alert', slug, '(RESEND_API_KEY or PLATFORM_NOTIFICATION_EMAIL not set — skipping)')
      return
    }
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://niblr.store').replace(/\/$/, '')
    const root = appUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')
    const { subject, html, replyTo } = composeNewStoreAlert({
      storeName,
      slug,
      ownerEmail,
      planLabel,
      storeUrl: `https://${slug}.${root}`,
      adminUrl: `${appUrl}/admin/collections/tenants/${tenantId}`,
    })
    await new Resend(apiKey).emails.send({ from: platformFrom(), to, subject, html, replyTo })
  } catch (err) {
    console.error('[email] sendNewStoreAlert failed:', err)
  }
}

/**
 * Send a magic-link sign-in email containing a single-use, 15-minute link.
 * No-ops with a log when RESEND_API_KEY is unset. NEVER throws.
 */
export async function sendMagicLink(to: string, magicUrl: string, storeName: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log('[email] magic link for', to, '(RESEND_API_KEY not set — skipping)')
      return
    }
    const html = await renderMagicLink({ magicUrl, storeName })
    await new Resend(apiKey).emails.send({
      from: platformFrom(),
      to,
      subject: `Sign in to ${storeName}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendMagicLink failed:', err)
  }
}
