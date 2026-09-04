import { render } from '@react-email/render'
import type { ReactElement } from 'react'

/**
 * Render a React Email element to an HTML string for Resend.
 * `async` + `return render(el)` is robust to react-email's `render` being either
 * sync (string) or async (Promise<string>) across versions — both flatten to a
 * Promise<string> here.
 */
export async function renderEmail(el: ReactElement): Promise<string> {
  return render(el)
}

export const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://niblr.store'
