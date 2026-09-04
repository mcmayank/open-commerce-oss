import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCsp, FONT_STYLESHEET_HOSTS, FONT_FILE_HOSTS, TURNSTILE_HOST } from './csp'
import { GOOGLE_FONTS_CSS2_BASE } from './fonts/url'

/**
 * Both root layouts under src/app are the only things that load fonts, and
 * proxy.ts's matcher covers both route groups — so the hosts this policy has to
 * admit are derived from those files rather than restated here. A font family
 * added to either layout from a new host fails these tests instead of silently
 * falling back to system-ui in every visitor's browser.
 */
/**
 * JSX comment blocks are stripped before splitting on `<link`, because a
 * comment mentioning both words ("stylesheet", "<link>") in prose — exactly
 * what explaining this derivation to the next reader tends to require —
 * otherwise gets swallowed into the neighbouring tag's chunk and
 * misclassified. Discovered the hard way: a real layout comment describing
 * StoreTheme's runtime-built `<link>` made `fonts.gstatic.com` look like a
 * stylesheet host, silently emptying `preconnectOnlyHosts`. This is still not
 * a real HTML/JSX parser on purpose — it only closes this one class of false
 * positive.
 */
const stripJsxComments = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

// (platform) is hosted-only and absent from the OSS export; check what exists.
const LAYOUTS = ['(storefront)/layout.tsx', '(platform)/layout.tsx']
  .filter((p) => existsSync(join(process.cwd(), 'src/app', p)))
  .map((p) => stripJsxComments(readFileSync(join(process.cwd(), 'src/app', p), 'utf8')))
const hostsOf = (line: string) => Array.from(line.matchAll(/https:\/\/[\w.-]+/g), (m) => m[0])
/**
 * Hosts loaded as `<link rel="stylesheet">` — governed by style-src-elem.
 * Two sources: static links in the layouts, and the storefront's RUNTIME font
 * link, which StoreTheme builds from GOOGLE_FONTS_CSS2_BASE per tenant. The
 * marketing site self-hosts F37 Bolton via next/font (29 Aug 2026), so the
 * runtime builder is now the only thing that makes fonts.googleapis.com a
 * stylesheet host at all.
 */
const stylesheetHosts = new Set([
  ...LAYOUTS.flatMap((src) =>
    src
      .split('<link')
      .filter((tag) => tag.includes('stylesheet'))
      .flatMap(hostsOf),
  ),
  ...hostsOf(GOOGLE_FONTS_CSS2_BASE),
])
/** Hosts preconnected but never linked as a stylesheet — i.e. the font-file host. */
const preconnectOnlyHosts = new Set(
  LAYOUTS.flatMap((src) =>
    src
      .split('<link')
      .filter((tag) => tag.includes('preconnect'))
      .flatMap(hostsOf),
  ).filter((h) => !stylesheetHosts.has(h)),
)

const directive = (csp: string, name: string) =>
  csp.split(';').find((d) => d.trim().startsWith(`${name} `))

describe('font hosts', () => {
  it('derives a non-empty host set from the layouts, so the tests below cannot pass vacuously', () => {
    expect(stylesheetHosts.size).toBeGreaterThan(0)
    expect(preconnectOnlyHosts.size).toBeGreaterThan(0)
    expect([...stylesheetHosts]).toEqual([...FONT_STYLESHEET_HOSTS])
    expect([...preconnectOnlyHosts]).toEqual([...FONT_FILE_HOSTS])
  })

  it('allows every cross-origin stylesheet the layouts <link> in, on style-src-elem', () => {
    // CSP3's style-src-elem governs <link rel="stylesheet">, not just <style>.
    // Without this, Google Fonts is blocked on every storefront AND every
    // marketing page, and each tenant on a non-system font falls silently back
    // to system-ui/Georgia.
    const elem = directive(buildCsp('x'), 'style-src-elem')
    for (const host of stylesheetHosts) expect(elem).toContain(host)
  })

  it('repeats those hosts on the style-src fallback, for browsers without CSP3', () => {
    // A browser that does not implement style-src-elem falls back to style-src
    // for elements, so the host has to be on both or those browsers still block.
    const style = directive(buildCsp('x'), 'style-src')
    for (const host of stylesheetHosts) expect(style).toContain(host)
  })

  it('allows the font-file host on font-src', () => {
    const font = directive(buildCsp('x'), 'font-src')
    for (const host of preconnectOnlyHosts) expect(font).toContain(host)
  })

  it('strips JSX comments before deriving hosts, so prose mentioning "stylesheet" and "<link>" cannot be misread as a tag', () => {
    // Regression fixture for the false positive this derivation hit for real:
    // a comment that legitimately needs to say both words in explaining the
    // code must not get fused into the next tag's chunk.
    const fixture = `
      <link rel="preconnect" href="https://fonts.gstatic.com" />
      {/*
        This comment mentions a stylesheet and even a literal <link> tag in
        its prose, on purpose, to prove the stripper handles both trigger
        words the naive splitter used to misclassify.
      */}
      <link rel="stylesheet" href="https://example.com/x.css" />
    `
    const stripped = stripJsxComments(fixture)
    const styleHosts = new Set(
      stripped
        .split('<link')
        .filter((tag) => tag.includes('stylesheet'))
        .flatMap(hostsOf),
    )
    expect([...styleHosts]).toEqual(['https://example.com'])
  })
})

describe('storefront font host', () => {
  /**
   * The storefront's font <link> is built at runtime by src/lib/fonts/url.ts,
   * so it carries no literal URL for the layout-parsing derivation above to
   * find. Deriving the origin from the builder's own constant keeps the policy
   * pinned to the code that actually emits the request.
   */
  it('admits the origin the storefront font URL builder emits', () => {
    const origin = new URL(GOOGLE_FONTS_CSS2_BASE).origin
    expect(origin).toBe('https://fonts.googleapis.com')
    expect(FONT_STYLESHEET_HOSTS).toContain(origin)
    expect(directive(buildCsp('x'), 'style-src-elem')).toContain(origin)
    expect(directive(buildCsp('x'), 'style-src')).toContain(origin)
  })
})

describe('buildCsp', () => {
  it('binds script-src to the request nonce', () => {
    const csp = buildCsp('abc123')
    expect(csp).toContain("script-src 'self' 'nonce-abc123'")
  })

  it('locks style-src-elem to the nonce, so an unnonced <style> is refused', () => {
    const csp = buildCsp('abc123')
    expect(csp).toContain("style-src-elem 'self' 'nonce-abc123'")
    expect(csp).not.toMatch(/style-src-elem[^;]*unsafe-inline/)
  })

  it("allows inline style attributes via style-src-attr, since a nonce can't attach to an attribute", () => {
    const csp = buildCsp('abc123')
    expect(csp).toContain("style-src-attr 'unsafe-inline'")
  })

  it('does not defeat the nonce by putting unsafe-inline on style-src-elem or style-src-attr together with a nonce meant to be exclusive', () => {
    // style-src (the combined fallback for older browsers) is allowed to carry
    // both, per spec unsafe-inline is ignored there once a nonce is present —
    // but style-src-elem must never get unsafe-inline, or the nonce is moot.
    const csp = buildCsp('abc123')
    const elemDirective = csp.split(';').find((d) => d.trim().startsWith('style-src-elem'))
    expect(elemDirective).not.toContain('unsafe-inline')
  })

  it('forbids framing, which blocks clickjacking of the storefront', () => {
    expect(buildCsp('x')).toContain("frame-ancestors 'none'")
  })

  it('restricts form submissions to our own origin', () => {
    expect(buildCsp('x')).toContain("form-action 'self'")
  })

  it('allows the analytics script hosts actually used by AnalyticsScripts/PixelScripts', () => {
    const csp = buildCsp('x')
    const scriptDirective = csp.split(';').find((d) => d.trim().startsWith('script-src'))
    for (const host of [
      'https://www.googletagmanager.com',
      'https://connect.facebook.net',
      'https://analytics.tiktok.com',
      'https://s.pinimg.com',
      'https://sc-static.net',
      'https://www.clarity.ms',
      'https://static.hotjar.com',
    ]) {
      expect(scriptDirective).toContain(host)
    }
  })

  it('has a connect-src permitting analytics beacons, not just default-src', () => {
    const csp = buildCsp('x')
    expect(csp).toMatch(/connect-src 'self'/)
    const connectDirective = csp.split(';').find((d) => d.trim().startsWith('connect-src'))
    // The two hosts the brief this was built from omitted entirely.
    expect(connectDirective).toContain('https://ct.pinterest.com')
    expect(connectDirective).toContain('https://www.facebook.com')
  })

  it('allows exactly the iframe hosts the shipped video and map blocks embed, and nothing wider', () => {
    // Pins the fix for a regression the initial home/product/cart/checkout
    // browser pass missed entirely: `frame-src 'none'` blocked
    // VideoEmbed's YouTube/Vimeo iframe and Contact's Google Maps iframe on
    // every page that used them, because none of the pages first checked
    // render either block. src/blocks/lib/video-embed.ts's
    // normalizeEmbedUrl has exactly two possible return origins; Google
    // Maps' own Share > Embed dialog emits src URLs on google.com.
    const csp = buildCsp('x')
    const frameDirective = csp.split(';').find((d) => d.trim().startsWith('frame-src'))
    expect(frameDirective).toContain('https://www.youtube.com')
    expect(frameDirective).toContain('https://player.vimeo.com')
    expect(frameDirective).toContain('https://www.google.com')
    // Must not be a bare https: wildcard — that would reopen the
    // clickjacking/overlay surface frame-ancestors 'none' exists to close.
    expect(frameDirective).not.toContain('https:;')
    expect(frameDirective?.trim()).not.toBe('frame-src https:')
  })

  it('allows the Turnstile host on script-src, connect-src and frame-src, for the signup widget', () => {
    const csp = buildCsp('x')
    for (const name of ['script-src', 'connect-src', 'frame-src']) {
      const dir = csp.split(';').find((d) => d.trim().startsWith(name))
      expect(dir).toContain(TURNSTILE_HOST)
    }
  })

  it('produces a different nonce token for a different input, not a fixed policy', () => {
    expect(buildCsp('nonce-one')).toContain('nonce-nonce-one')
    expect(buildCsp('nonce-two')).toContain('nonce-nonce-two')
  })
})
