import { defineConfig, devices } from '@playwright/test'

/**
 * Component-level real-browser layout checks — deliberately NOT a project
 * inside playwright.config.ts, mirroring playwright.shots.config.ts's
 * reasoning: this exercises real Chromium layout (flex cross-axis alignment,
 * margin:auto), which jsdom (vitest) cannot do at all — jsdom has no layout
 * engine, so a className-string assertion can prove a class is present but
 * never that it positions anything correctly.
 *
 * No `webServer` here on purpose: specs SSR a block component directly
 * (`renderToStaticMarkup`) and hand the markup to `page.setContent()` — no
 * Next.js dev server, no database, no seeded store. That is what keeps this
 * cheap enough to run in any environment, including ones with no local
 * Postgres.
 */
export default defineConfig({
  testDir: './tests/component',
  testMatch: /.*\.component\.ts/,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    viewport: { width: 800, height: 600 },
  },
})
