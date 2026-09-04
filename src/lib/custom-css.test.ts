import { describe, it, expect } from 'vitest'
import { sanitizeCustomCss, CustomCssError, MAX_CUSTOM_CSS_BYTES } from './custom-css'

describe('sanitizeCustomCss', () => {
  it('passes valid CSS through unchanged in substance', () => {
    const css = '[data-nb-block="hero"] [data-nb-part="heading"] { letter-spacing: -0.02em; }'
    expect(sanitizeCustomCss(css)).toContain('letter-spacing')
  })

  it('returns empty string for a non-string or blank input', () => {
    expect(sanitizeCustomCss(null)).toBe('')
    expect(sanitizeCustomCss('   ')).toBe('')
  })

  it('strips @import, which would fetch past every other rule', () => {
    const out = sanitizeCustomCss('@import url("https://evil.test/x.css");\na { color: red; }')
    expect(out).not.toContain('@import')
    expect(out).toContain('color: red')
  })

  it('strips @IMPORT and @Import too, since postcss preserves author casing', () => {
    expect(sanitizeCustomCss('@IMPORT url("https://evil.test/x.css");')).not.toContain('evil.test')
    expect(sanitizeCustomCss('@Import url("https://evil.test/x.css");')).not.toContain('evil.test')
  })

  it('strips an external url(), which discloses every visitor to a third party', () => {
    const out = sanitizeCustomCss('a { background-image: url("https://evil.test/pixel.png"); color: red; }')
    expect(out).not.toContain('evil.test')
    expect(out).toContain('color: red')
  })

  it('strips a protocol-relative url() too', () => {
    expect(sanitizeCustomCss('a { background: url(//evil.test/p.png); }')).not.toContain('evil.test')
  })

  it('strips a url() hiding an external origin behind a hex escape', () => {
    // \68 is the CSS hex escape for "h" — a browser resolves this to https://…
    expect(sanitizeCustomCss('a { background: url(\\68ttps://evil.test/x); }')).not.toContain('evil.test')
  })

  it('strips a url() hiding an external origin behind a spliced comment', () => {
    expect(sanitizeCustomCss('a { background: url(/**/https://evil.test/x); }')).not.toContain('evil.test')
  })

  it('strips an external url() inside @font-face src, which walkDecls still reaches', () => {
    const out = sanitizeCustomCss('@font-face { font-family: "X"; src: url(https://evil.test/f.woff); }')
    expect(out).not.toContain('evil.test')
  })

  it('keeps a relative url(), which stays on the merchant’s own origin', () => {
    expect(sanitizeCustomCss('a { background: url("/media/bg.png"); }')).toContain('/media/bg.png')
  })

  it('keeps a data: url(), which makes no request', () => {
    expect(sanitizeCustomCss('a { background: url(data:image/gif;base64,R0lGOD); }')).toContain('data:image/gif')
  })

  it('keeps a #fragment url(), a same-document reference that issues no request', () => {
    expect(sanitizeCustomCss('.x { filter: url(#blur); }')).toContain('#blur')
    expect(sanitizeCustomCss('.x { fill: url(#gradient); }')).toContain('#gradient')
  })

  it('still strips an external url() with a fragment tacked on, which is not a lone #id', () => {
    const out = sanitizeCustomCss('a { background: url(https://evil.test/x#frag); }')
    expect(out).not.toContain('evil.test')
  })

  it('strips a url() with a nested paren, which a naive non-nesting-aware scan would misparse as root-relative', () => {
    const out = sanitizeCustomCss('a { background: url(/a(https://evil.test/x)); }')
    expect(out).not.toContain('evil.test')
  })

  it('keeps a quoted relative url() containing a space', () => {
    expect(sanitizeCustomCss('a { background: url(/a.png); }')).toContain('/a.png')
    expect(sanitizeCustomCss('a { background: url("/a b.png"); }')).toContain('/a b.png')
  })

  it('strips an empty or whitespace-only url()', () => {
    expect(sanitizeCustomCss('a { background: url(); color: red; }')).not.toContain('url(')
    expect(sanitizeCustomCss('a { background: url(   ); color: red; }')).not.toContain('url(')
  })

  it('strips image-set(), whose string argument is a URL just as much as url()’s is', () => {
    const out = sanitizeCustomCss('.x { background-image: image-set("https://evil.test/a.png" 1x); color: red; }')
    expect(out).not.toContain('evil.test')
    expect(out).toContain('color: red')
  })

  it('strips -webkit-image-set(), the prefixed spelling every shipping browser still accepts', () => {
    const out = sanitizeCustomCss(
      '.x { background-image: -webkit-image-set("https://evil.test/a.png" 1x); color: red; }',
    )
    expect(out).not.toContain('evil.test')
    expect(out).toContain('color: red')
  })

  it('strips a url() whose own function NAME is hidden behind an escape', () => {
    // \75 is the CSS hex escape for "u", so a browser tokenizes this as url(…).
    // The escape hides in the function name, which a scan keyed on the literal
    // text "url(" never reaches.
    const out = sanitizeCustomCss('.x { background-image: \\75 rl("https://evil.test/a.png"); color: red; }')
    expect(out).not.toContain('evil.test')
    expect(out).toContain('color: red')
  })

  it('strips an escaped image-set() function name too', () => {
    expect(
      sanitizeCustomCss('.x { background-image: \\69 mage-set("https://evil.test/a.png" 1x); }'),
    ).not.toContain('evil.test')
  })

  it('strips @font-face src(), the string-argument sibling of url()', () => {
    const out = sanitizeCustomCss('@font-face { font-family: "X"; src: src("https://evil.test/f.woff"); }')
    expect(out).not.toContain('evil.test')
  })

  it('strips any declaration with an escape outside a quoted string, without decoding it', () => {
    // Refusing beats decoding: an escape can hide a function name, a property
    // keyword, or a scheme, and merchant CSS has no legitimate need for one.
    expect(sanitizeCustomCss('.x { position: \\66 ixed; color: red; }')).not.toContain('\\66')
    expect(sanitizeCustomCss('.x { \\70 osition: fixed; color: red; }')).not.toContain('fixed')
  })

  it('keeps an escape inside a quoted string, which is only ever text', () => {
    // content: "\2014" (an em dash) is ordinary merchant CSS and issues no request.
    expect(sanitizeCustomCss('.x::after { content: "\\2014"; }')).toContain('\\2014')
  })

  it('keeps image-set() built from allowlisted url() arguments', () => {
    const out = sanitizeCustomCss('.x { background-image: image-set(url(/a.png) 1x, url(/b.png) 2x); }')
    expect(out).toContain('/a.png')
    expect(out).toContain('/b.png')
  })

  it('escapes a </style> sequence so merchant CSS cannot close its own <style> tag', () => {
    // The injected CSS lands inside a <style> element, where a literal
    // "</style>" would end it and turn everything after into markup. postcss's
    // stringifier escapes it; package.json pins postcss with a caret, so this
    // pins the behaviour we actually depend on.
    const out = sanitizeCustomCss('a { content: "</style><img src=x>" }')
    expect(out).not.toContain('</style')
  })

  it('strips position: fixed, the full-viewport overlay shape', () => {
    const out = sanitizeCustomCss('.x { position: fixed; color: red; }')
    expect(out).not.toContain('fixed')
    expect(out).toContain('color: red')
  })

  it('keeps position: sticky, which is not an overlay risk', () => {
    expect(sanitizeCustomCss('.x { position: sticky; }')).toContain('sticky')
  })

  it('throws on malformed CSS rather than injecting it', () => {
    expect(() => sanitizeCustomCss('a { color: red')).toThrow(CustomCssError)
  })

  it('throws above the size cap', () => {
    expect(() => sanitizeCustomCss('a{}'.repeat(MAX_CUSTOM_CSS_BYTES))).toThrow(CustomCssError)
  })
})
