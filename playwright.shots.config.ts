import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

/**
 * Screenshot capture — deliberately NOT a project inside playwright.config.ts.
 *
 * Capture produces artifacts, not assertions, and must never run as part of
 * `pnpm test:e2e`. There is still no `webServer` here: storefront capture hits
 * public production URLs, so it needs no dev server, no database and no auth.
 *
 * ADMIN capture (`admin-builder.shots.ts`) does need all three, which is why it
 * was deferred when this file was written. It is no longer deferred, but it is
 * not self-sufficient either: it expects a dev server already running at
 * `SHOTS_ADMIN_ORIGIN` (default `http://docs-shots.lvh.me:3000`) against a
 * database it may write a throwaway tenant into. Run it deliberately, never in
 * CI. The `.env` loading below exists for that half only — the storefront
 * captures need none of it — because the spec boots Payload directly to seed,
 * and dotenv is NOT loaded by Playwright itself (see playwright.config.ts's
 * note: `dotenv/config` reads `.env` and nothing else, so `.env.local` — where
 * DATABASE_URL actually lives — has to be loaded explicitly and last).
 */
export default defineConfig({
  testDir: './tests/shots',
  testMatch: /.*\.shots\.ts/,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    /**
     * Sets prefers-reduced-motion, which `effects/reduced-motion.ts` already
     * reads via usePrefersReducedMotion(). ScrambleText, Reveal and
     * OdometerNumber therefore settle to their final state instead of being
     * caught mid-animation. Without this every capture differs from the last
     * and the weekly refresh PR drowns in false positives.
     *
     * Nested under `contextOptions` rather than set directly on `use`: in
     * @playwright/test 1.58.2, `reducedMotion` is a `BrowserContextOptions`
     * field, not a top-level `PlaywrightTestOptions` field — `use.reducedMotion`
     * fails `tsc --noEmit`. This is the config shape the type's own JSDoc
     * documents for exactly this case.
     */
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },
})
