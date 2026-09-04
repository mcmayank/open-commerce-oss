import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke suite for the single-store build. Shipped by the export
 * (oss/smoke/ in the private repo); edit it there.
 *
 * Runs against a PRODUCTION build (`pnpm build` first) on an EMPTY, migrated
 * database: the suite creates the first user, the store settings and a product
 * itself, then walks the storefront and the admin as a shopper and an owner
 * would. It is the runnable proof that a fresh clone works end to end, so it
 * is deliberately small and deliberately serial.
 *
 *   pnpm payload migrate && pnpm build && pnpm test:smoke
 */
export default defineConfig({
  testDir: './tests/smoke',
  testMatch: /.*\.smoke\.ts/,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000/admin/login',
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
