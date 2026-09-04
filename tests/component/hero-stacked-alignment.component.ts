import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

/**
 * Real-browser layout regression test for the Hero `stacked` variant's
 * eyebrow alignment — see .superpowers/sdd/2026-08-17-block-style-system/
 * task-8-report.md, "Fix round 1".
 *
 * The bug: the eyebrow.treatment bundle (Task 8) unconditionally applies
 * `inline-block w-fit` to the eyebrow so a `pill` treatment can size itself
 * to its content. In `stacked`, the eyebrow's parent is a `flex flex-col`
 * container that previously centered/left/right-aligned the (block-level,
 * stretching) eyebrow purely via `text-align`. Giving the eyebrow an
 * explicit width opts it out of cross-axis stretch, so — regardless of any
 * style override — it silently pins to flex-start (left) instead of
 * following `textAlign`. `heading`/`subheading` stay block-level and are
 * unaffected; only the eyebrow's own alignSelf class (added in the fix)
 * prevents this.
 *
 * jsdom (vitest) has no layout engine, so a className-string assertion can
 * prove `mx-auto`/`ml-auto`/`mr-auto` is present but never that it actually
 * centers or pins anything — the original bug shipped with green
 * className-only tests. This spec renders the REAL component
 * (`renderToStaticMarkup`, the actual source of truth, not a hand-copied
 * markup fixture) through the REAL compiled Tailwind CSS in a REAL Chromium
 * layout engine (Playwright, no dev server / DB — see
 * playwright.component.config.ts) and measures bounding boxes.
 */

let css = ''

test.beforeAll(async () => {
  // Compile the project's actual Tailwind build so every utility class the
  // real Hero markup uses (including the arbitrary `--bs-*`-reading ones)
  // gets its real, current CSS — not a hand-maintained approximation that
  // could silently drift from what Component.tsx actually emits.
  const globalsPath = path.resolve(process.cwd(), 'src/app/(storefront)/globals.css')
  const source = fs.readFileSync(globalsPath, 'utf8')
  const result = await postcss([tailwindcss({ base: process.cwd() })]).process(source, { from: globalsPath })
  css = result.css
})

function pageFor(html: string): string {
  // width:800px pins the layout viewport so max-w-[42rem] (672px) leaves
  // visible room on both sides — required for the centered-vs-left
  // assertions below to be meaningful.
  return `<!doctype html><html><head><style>${css}</style></head><body style="margin:0;width:800px">${html}</body></html>`
}

/**
 * Renders the REAL HeroComponent (`renderToStaticMarkup`, source of truth,
 * not a hand-copied markup fixture) out-of-process via plain `npx tsx` — see
 * render-hero-stacked.tsx for why this can't run inside Playwright's own
 * test process.
 */
const RENDER_SCRIPT = path.resolve(process.cwd(), 'tests/component/render-hero-stacked.tsx')

function renderStacked(textAlign?: 'left' | 'center' | 'right'): string {
  return execFileSync('npx', ['tsx', RENDER_SCRIPT, textAlign ?? ''], {
    encoding: 'utf8',
    cwd: process.cwd(),
  })
}

test('default (un-styled) stacked hero centers its eyebrow, matching the un-styled default (textAlign unset -> center)', async ({ page }) => {
  await page.setContent(pageFor(renderStacked()))
  const eyebrow = page.locator('[data-nb-part="eyebrow"]')
  // The heading stays block-level and stretches to the full width of the
  // (padded) content column, so its own box IS that column's inner content
  // box — a more precise reference than the column div itself, whose
  // boundingBox() includes padding (px-6/sm:px-8) the eyebrow sits inside of.
  const content = page.locator('[data-nb-part="heading"]')
  const eyebrowBox = await eyebrow.boundingBox()
  const contentBox = await content.boundingBox()
  expect(eyebrowBox).toBeTruthy()
  expect(contentBox).toBeTruthy()
  const eyebrowCenter = eyebrowBox!.x + eyebrowBox!.width / 2
  const contentCenter = contentBox!.x + contentBox!.width / 2
  // Real layout assertion (not a className check): the eyebrow's own visual
  // center must land at its container's center. Before the fix, `w-fit`
  // pinned it to flex-start (left) instead — this would fail on that code.
  expect(Math.abs(eyebrowCenter - contentCenter)).toBeLessThan(2)
})

test('textAlign left pins the stacked eyebrow to the left edge', async ({ page }) => {
  await page.setContent(pageFor(renderStacked('left')))
  const eyebrow = page.locator('[data-nb-part="eyebrow"]')
  // The heading stays block-level and stretches to the full width of the
  // (padded) content column, so its own box IS that column's inner content
  // box — a more precise reference than the column div itself, whose
  // boundingBox() includes padding (px-6/sm:px-8) the eyebrow sits inside of.
  const content = page.locator('[data-nb-part="heading"]')
  const eyebrowBox = await eyebrow.boundingBox()
  const contentBox = await content.boundingBox()
  expect(Math.abs(eyebrowBox!.x - contentBox!.x)).toBeLessThan(2)
})

test('textAlign right pins the stacked eyebrow to the right edge', async ({ page }) => {
  await page.setContent(pageFor(renderStacked('right')))
  const eyebrow = page.locator('[data-nb-part="eyebrow"]')
  // The heading stays block-level and stretches to the full width of the
  // (padded) content column, so its own box IS that column's inner content
  // box — a more precise reference than the column div itself, whose
  // boundingBox() includes padding (px-6/sm:px-8) the eyebrow sits inside of.
  const content = page.locator('[data-nb-part="heading"]')
  const eyebrowBox = await eyebrow.boundingBox()
  const contentBox = await content.boundingBox()
  const eyebrowRight = eyebrowBox!.x + eyebrowBox!.width
  const contentRight = contentBox!.x + contentBox!.width
  expect(Math.abs(eyebrowRight - contentRight)).toBeLessThan(2)
})
