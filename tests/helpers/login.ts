import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 */
export async function login({
  page,
  serverURL = 'http://localhost:3000',
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/admin/login`)

  // Fill AFTER React has hydrated, and prove it stuck.
  //
  // Payload's login form is a client component with controlled inputs. Playwright's
  // `fill()` writes straight to the DOM, so a fill that lands before hydration is
  // silently discarded when React attaches and re-renders the field from its own
  // (empty) state. Measured on this app: the value is present immediately and gone
  // ~2s later. The click then submits an EMPTY form, and the page answers "Please
  // enter a valid email address" / "This field is required" — which reads like bad
  // credentials but is a race.
  //
  // `toHaveValue` retries until Playwright's timeout, so this is condition-based:
  // it waits for the exact state we need rather than sleeping a guessed interval.
  // Re-filling inside the retry is what survives the one-shot hydration wipe.
  const emailField = page.locator('#field-email')
  const passwordField = page.locator('#field-password')

  await expect(async () => {
    await emailField.fill(user.email)
    await passwordField.fill(user.password)
    await expect(emailField).toHaveValue(user.email, { timeout: 1000 })
    await expect(passwordField).toHaveValue(user.password, { timeout: 1000 })
  }).toPass()

  await page.click('button[type="submit"]')

  // Not `load`: an authenticated admin page in this app never fires it (see the
  // note at the top of tests/e2e/admin.e2e.spec.ts), so waiting for it here hung
  // until the hook timeout even though login had already succeeded.
  await page.waitForURL(`${serverURL}/admin`, { waitUntil: 'domcontentloaded' })

  // Assert against the nav this app actually renders. `span[title="Dashboard"]`
  // is Payload's STOCK nav markup, and `payload.config.ts` replaces `Nav` with
  // this repo's bespoke `AdminNav` (src/components/admin/shell/AdminNav.client.tsx),
  // which renders a `<Link href="/admin">Dashboard</Link>`. The old selector
  // matched nothing, so login appeared to fail long after it had actually
  // succeeded. Role-based so it survives class and styling churn.
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible()
}
