/** Escape a string for safe interpolation into an HTML context. Mirrors src/lib/email.ts. */
function escapeHtml(s: unknown): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c] ?? c,
  )
}

export interface RenderCampaignEmailInput {
  subject: string
  /** Pre-rendered HTML body (caller converts lexical richText to HTML before passing). */
  bodyHtml: string
  storeName: string
  unsubscribeUrl: string
}

export interface RenderCampaignEmailResult {
  subject: string
  html: string
}

/**
 * Wrap `bodyHtml` in a minimal responsive HTML email layout.
 *
 * Layout:
 *  - Header: store name (escaped)
 *  - Body:   bodyHtml verbatim
 *  - Footer: unsubscribe link + physical-address placeholder (CAN-SPAM)
 *
 * The storeName is HTML-escaped; unsubscribeUrl is used verbatim in the href
 * (callers must provide a safe URL).
 */
export function renderCampaignEmail({
  subject,
  bodyHtml,
  storeName,
  unsubscribeUrl,
}: RenderCampaignEmailInput): RenderCampaignEmailResult {
  const safeStoreName = escapeHtml(storeName)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${safeStoreName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#111;padding:20px 24px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;">${safeStoreName}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;font-size:15px;line-height:1.6;color:#111;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f5;padding:20px 24px;text-align:center;font-size:12px;color:#888;">
              <p style="margin:0 0 8px;">
                You are receiving this email because you subscribed to ${safeStoreName}.
              </p>
              <p style="margin:0 0 8px;">
                <a href="${unsubscribeUrl}" style="color:#555;text-decoration:underline;">Unsubscribe</a>
              </p>
              <p style="margin:0;font-size:11px;color:#aaa;">
                Physical address: 123 Commerce Street, San Francisco, CA 94105, US
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
