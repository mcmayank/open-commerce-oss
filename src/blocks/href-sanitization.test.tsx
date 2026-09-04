/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'

import { CTABannerComponent } from './CTABanner/Component'
import { HeroComponent } from './Hero/Component'
import { LogoStripComponent } from './LogoStrip/Component'
import { PromoSectionComponent } from './PromoSection/Component'
import { MediaHeroComponent } from './MediaHero/Component'
import { SplitHeroComponent } from './SplitHero/Component'
import { VideoEmbedComponent } from './VideoEmbed/Component'
import { ContactComponent } from './Contact/Component'
import { RichTextComponent } from './RichText/Component'

/**
 * VideoEmbed never puts the raw `url` field into an href directly — it goes
 * through normalizeEmbedUrl first, which only ever returns a hardcoded
 * `https://` literal (built from a regex-extracted id) or null. That means a
 * `javascript:` `url` can never reach playHref through the real normalizer,
 * so a test using it unmocked would pass even with safeHref ripped out —
 * exercising normalizeEmbedUrl's accidental safety, not safeHref's. Mocking
 * the normalizer to (mis)behave as if it forwarded the raw scheme is what
 * makes this test actually exercise VideoEmbedComponent's own safeHref(src)
 * call, so it fails if that call is ever removed.
 */
vi.mock('@/blocks/lib/video-embed', () => ({
  normalizeEmbedUrl: () => 'javascript:alert(document.cookie)',
}))

afterEach(cleanup)

const ctx = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {} as unknown as import('payload').Payload,
}

/**
 * Two malicious schemes appear throughout this file, deliberately, and are
 * not duplicates of each other:
 *
 * - `javascript:` — React's own DOM renderer already strips this from
 *   `href`/`src` in production builds (confirmed: it replaces the value with
 *   a string that throws "React has blocked a javascript: URL..."). Every
 *   `javascript:` case here proves this fix does not *depend* on that
 *   framework behavior continuing — safeHref rejects it independently,
 *   before React ever sees the string.
 * - `data:text/html,...` — React does **not** sanitize this one; it passes
 *   straight through to `href`/`src` in production. In an `<iframe src>`
 *   (Contact's map embed) it executes on load with no click needed, which is
 *   why that block gets a dedicated `data:` case. This is the scheme that
 *   was actually exploitable before this fix — do not delete these cases as
 *   "the same test twice".
 */
const XSS = 'javascript:alert(document.cookie)'
const XSS_DATA = 'data:text/html,<script>alert(document.cookie)</script>'

/** Minimal lexical doc: one paragraph containing a single custom link node. */
function lexicalLinkDoc(url: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              fields: { linkType: 'custom', url, newTab: false },
              children: [{ type: 'text', text: 'Click me', version: 1 }],
              direction: 'ltr' as const,
              format: '' as const,
              indent: 0,
              version: 1,
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

describe('stored javascript: hrefs are sanitized before reaching the DOM', () => {
  it('CTABanner drops a javascript: buttonHref but still renders its heading', () => {
    const { container } = render(
      <CTABannerComponent
        block={{ heading: 'Banner heading', buttonLabel: 'Shop now', buttonHref: XSS } as never}
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Banner heading')
  })

  it('CTABanner drops a data:text/html buttonHref but still renders its heading', () => {
    const { container } = render(
      <CTABannerComponent
        block={{ heading: 'Banner heading', buttonLabel: 'Shop now', buttonHref: XSS_DATA } as never}
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Banner heading')
  })

  it('Hero drops a javascript: ctaHref but still renders its heading', () => {
    const { container } = render(
      <HeroComponent block={{ heading: 'Hero heading', ctaLabel: 'Go', ctaHref: XSS } as never} ctx={ctx} />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Hero heading')
  })

  it('LogoStrip drops a javascript: logo href but still renders the logo image', () => {
    const { container } = render(
      <LogoStripComponent
        block={
          { heading: 'Trusted by', logos: [{ image: { url: '/logo.png' }, label: 'Acme', href: XSS }] } as never
        }
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('PromoSection drops javascript: primary/secondary CTA hrefs but still renders its heading', () => {
    const { container } = render(
      <PromoSectionComponent
        block={
          {
            heading: 'Promo heading',
            eyebrow: 'Eyebrow',
            primaryCtaLabel: 'Shop',
            primaryCtaHref: XSS,
            secondaryCtaLabel: 'Learn more',
            secondaryCtaHref: XSS,
          } as never
        }
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Promo heading')
  })

  it('MediaHero drops javascript: CTA hrefs, renders no empty CTA container, but still renders its heading', () => {
    const { container } = render(
      <MediaHeroComponent
        block={
          {
            heading: 'Media hero heading',
            primaryCtaLabel: 'Shop',
            primaryCtaHref: XSS,
            secondaryCtaLabel: 'Learn more',
            secondaryCtaHref: XSS,
          } as never
        }
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    // `[data-nb-part="cta"]` alone is not enough here: that attribute lives
    // only on the <Link> elements, which are already gated by
    // `label && href` regardless of how hasCta is computed. hasCta gates a
    // wrapper *above* those — assert the wrapper itself (mt-2 flex flex-wrap
    // gap-3) is gone, or a stale, raw-href-derived hasCta would still render
    // it empty and this assertion would pass either way.
    expect(container.querySelector('.mt-2.flex.flex-wrap.gap-3')).toBeNull()
    expect(container.textContent).toContain('Media hero heading')
  })

  it('MediaHero drops data:text/html CTA hrefs, renders no empty CTA container, but still renders its heading', () => {
    const { container } = render(
      <MediaHeroComponent
        block={
          {
            heading: 'Media hero heading',
            primaryCtaLabel: 'Shop',
            primaryCtaHref: XSS_DATA,
            secondaryCtaLabel: 'Learn more',
            secondaryCtaHref: XSS_DATA,
          } as never
        }
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('.mt-2.flex.flex-wrap.gap-3')).toBeNull()
    expect(container.textContent).toContain('Media hero heading')
  })

  it('SplitHero drops javascript: CTA hrefs but still renders its heading', () => {
    const { container } = render(
      <SplitHeroComponent
        block={
          {
            heading: 'Split hero heading',
            primaryCtaLabel: 'Shop',
            primaryCtaHref: XSS,
            secondaryCtaLabel: 'Learn more',
            secondaryCtaHref: XSS,
          } as never
        }
        ctx={ctx}
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Split hero heading')
  })

  it('VideoEmbed drops a javascript: playHref but still renders its heading', () => {
    const { container } = render(
      <VideoEmbedComponent
        block={
          {
            variant: 'textOverlay',
            heading: 'Video heading',
            provider: 'youtube',
            url: 'https://youtube.com/watch?v=abcdefgh',
          } as never
        }
        ctx={ctx}
      />,
    )
    // The anchor itself still renders (textOverlay always wraps the poster in
    // one) — only its href must be gone.
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBeNull()
    expect(container.textContent).toContain('Video heading')
  })

  it('Contact drops a javascript: mapEmbedUrl, renders no map frame, but still renders its details', () => {
    const { container } = render(
      <ContactComponent
        block={
          {
            variant: 'mapSplit',
            heading: 'Visit us',
            address: '123 Main St',
            mapEmbedUrl: XSS,
          } as never
        }
        ctx={ctx}
      />,
    )
    // hasMap must be derived from the sanitized value — otherwise the guard
    // that normally hides the iframe (`if (!hasMap) return null`) stays
    // fooled by the raw truthy string and still emits it with a poisoned src.
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toContain('Visit us')
    expect(container.textContent).toContain('123 Main St')
  })

  it('Contact drops a data:text/html mapEmbedUrl, renders no map frame, but still renders its details', () => {
    const { container } = render(
      <ContactComponent
        block={
          {
            variant: 'mapSplit',
            heading: 'Visit us',
            address: '123 Main St',
            mapEmbedUrl: XSS_DATA,
          } as never
        }
        ctx={ctx}
      />,
    )
    // This is the real vector: React does not sanitize `data:text/html` in an
    // `<iframe src>`, and it executes on load with no user interaction — see
    // the file-level comment. safeHref rejecting it is the only thing
    // stopping this from being live.
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toContain('Visit us')
    expect(container.textContent).toContain('123 Main St')
  })

  it('RichText drops a javascript: link href but keeps the link text', () => {
    const { container } = render(
      <RichTextComponent block={{ content: lexicalLinkDoc(XSS) } as never} ctx={ctx} />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Click me')
  })

  it('RichText drops a data:text/html link href but keeps the link text', () => {
    const { container } = render(
      <RichTextComponent block={{ content: lexicalLinkDoc(XSS_DATA) } as never} ctx={ctx} />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('Click me')
  })

  it('RichText still renders an ordinary https:// link', () => {
    const { container } = render(
      <RichTextComponent block={{ content: lexicalLinkDoc('https://example.com') } as never} ctx={ctx} />,
    )
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('https://example.com')
    expect(container.textContent).toContain('Click me')
  })
})

/**
 * Every case above is proven through `SharedRichText`, which is the ONLY thing
 * that installs the sanitizing link/autolink converters (src/blocks/lib/RichText.tsx).
 * A render site that imports `RichText` straight from
 * `@payloadcms/richtext-lexical/react` gets the library's DEFAULT converters —
 * `node.fields.url` with no scheme check — and silently opts out of all of it.
 *
 * The product detail page did exactly that: merchant-authored product
 * descriptions were the one lexical surface rendering unsanitized, which is
 * also the surface a store's own staff can edit.
 *
 * Asserted against the source rather than by rendering, because the PDP is an
 * async server component wired to Payload, theming and the cache — it cannot be
 * mounted here the way the blocks above are. A cheap import-level guard that
 * actually runs beats a faithful test that is too expensive to write.
 */
describe('storefront lexical render sites use the sanitizing wrapper', () => {
  const pdpSource = readFileSync(
    path.join(process.cwd(), 'src/app/(storefront)/store/[tenant]/products/[slug]/page.tsx'),
    'utf8',
  )

  /**
   * Matches an actual `import ... from '<pkg>'` statement, NOT a bare mention of
   * the package name. The fix deliberately leaves a comment in the page naming
   * the library renderer to say why it must not be used — a substring check
   * would fail on that comment and punish the documentation. Same lesson as the
   * prose-vs-tag stripper in src/lib/csp.test.ts.
   */
  it('the product detail page does not import the raw lexical renderer', () => {
    expect(pdpSource).not.toMatch(/^\s*import\s[^;]*?from\s+'@payloadcms\/richtext-lexical\/react'/m)
  })

  it('the product detail page renders descriptions through SharedRichText', () => {
    expect(pdpSource).toMatch(/\bSharedRichText\b/)
  })
})
