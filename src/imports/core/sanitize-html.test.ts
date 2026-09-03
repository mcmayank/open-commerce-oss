import { describe, it, expect } from 'vitest'
import { sanitizeDescriptionHtml } from './sanitize-html'

/** Convenience: assert nothing dangerous survived, whatever the exact output. */
function expectInert(input: string) {
  const out = sanitizeDescriptionHtml(input)
  expect(out).not.toMatch(/<script/i)
  expect(out).not.toMatch(/<iframe/i)
  expect(out).not.toMatch(/\bon\w+\s*=/i)
  expect(out).not.toMatch(/javascript:/i)
  return out
}

describe('sanitizeDescriptionHtml — keeps ordinary product copy', () => {
  it('preserves the formatting a description actually uses', () => {
    const html =
      '<p>A <strong>great</strong> bottle.</p><ul><li>Leak proof</li><li>BPA free</li></ul>'
    expect(sanitizeDescriptionHtml(html)).toBe(html)
  })

  it('keeps a plain http link', () => {
    const out = sanitizeDescriptionHtml('<p>See <a href="https://example.com/x">docs</a></p>')
    expect(out).toContain('href="https://example.com/x"')
    expect(out).toContain('docs')
  })

  it('keeps plain text unchanged', () => {
    expect(sanitizeDescriptionHtml('Just words.')).toBe('Just words.')
  })

  it('handles empty and missing input', () => {
    expect(sanitizeDescriptionHtml('')).toBe('')
    expect(sanitizeDescriptionHtml(null as unknown as string)).toBe('')
    expect(sanitizeDescriptionHtml(undefined as unknown as string)).toBe('')
  })
})

describe('sanitizeDescriptionHtml — removes script execution', () => {
  it('strips a script element and its contents', () => {
    const out = expectInert('<p>hi</p><script>alert(1)</script>')
    expect(out).toContain('hi')
    expect(out).not.toContain('alert(1)')
  })

  it('strips script regardless of case or attributes', () => {
    expectInert('<SCRIPT TYPE="text/javascript">alert(1)</SCRIPT>')
    expectInert('<ScRiPt>alert(1)</ScRiPt>')
  })

  it('strips an unclosed script element', () => {
    const out = expectInert('<p>hi</p><script>alert(1)')
    expect(out).not.toContain('alert(1)')
  })

  // The classic nested-strip bypass: removing the inner <script> from
  // "<scr<script>ipt>" reassembles a working tag unless stripping repeats.
  it('is not defeated by nesting a tag inside itself', () => {
    expectInert('<scr<script>ipt>alert(1)</scr</script>ipt>')
  })

  it('strips style, iframe, object, embed, svg and form', () => {
    for (const tag of ['style', 'iframe', 'object', 'embed', 'svg', 'form']) {
      const out = sanitizeDescriptionHtml(`<p>keep</p><${tag}>bad</${tag}>`)
      expect(out, `${tag} survived`).not.toMatch(new RegExp(`<${tag}`, 'i'))
      expect(out).toContain('keep')
    }
  })

  it('strips HTML comments, which can hide conditional markup', () => {
    expect(sanitizeDescriptionHtml('<p>a</p><!-- <script>alert(1)</script> -->')).not.toContain(
      'alert(1)',
    )
  })
})

describe('sanitizeDescriptionHtml — removes event handlers', () => {
  it('drops on* attributes while keeping the element', () => {
    const out = expectInert('<img src="https://example.com/a.png" onerror="alert(1)">')
    expect(out).toContain('src="https://example.com/a.png"')
  })

  it('drops handlers whatever the quoting or spacing', () => {
    expectInert(`<div onclick='alert(1)'>x</div>`)
    expectInert('<div onclick=alert(1)>x</div>')
    expectInert('<div OnClick = "alert(1)">x</div>')
    expectInert('<svg/onload=alert(1)>')
  })
})

describe('sanitizeDescriptionHtml — removes dangerous URLs', () => {
  it('drops a javascript: href but keeps the link text', () => {
    const out = expectInert('<a href="javascript:alert(1)">click</a>')
    expect(out).toContain('click')
    expect(out).not.toContain('href=')
  })

  it('drops javascript: however it is disguised', () => {
    expectInert('<a href="JaVaScRiPt:alert(1)">x</a>')
    expectInert('<a href="  javascript:alert(1)">x</a>')
    expectInert('<a href="java\tscript:alert(1)">x</a>')
    expectInert('<a href="java&#9;script:alert(1)">x</a>')
  })

  it('drops data: and vbscript: URLs', () => {
    const out = sanitizeDescriptionHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">')
    expect(out).not.toContain('data:')
    expect(sanitizeDescriptionHtml('<a href="vbscript:msgbox(1)">x</a>')).not.toContain('vbscript:')
  })

  it('keeps protocol-relative and relative URLs out, since they resolve off-origin', () => {
    expect(sanitizeDescriptionHtml('<a href="//evil.example/x">x</a>')).not.toContain('href=')
  })
})

describe('sanitizeDescriptionHtml — attribute allowlist', () => {
  it('drops attributes that are not on the allowlist', () => {
    const out = sanitizeDescriptionHtml(
      '<p class="x" style="color:red" data-tracking="1" id="y">text</p>',
    )
    expect(out).toBe('<p>text</p>')
  })

  it('keeps href, src, alt and title', () => {
    const out = sanitizeDescriptionHtml(
      '<img src="https://example.com/a.png" alt="A bottle" title="t">',
    )
    expect(out).toContain('src="https://example.com/a.png"')
    expect(out).toContain('alt="A bottle"')
    expect(out).toContain('title="t"')
  })

  // The payload here is `alt='a" onerror="x'`: a single-quoted value containing
  // a double quote, hoping to close `alt` early and start a new attribute. The
  // text "onerror=" legitimately survives INSIDE the value — what must not
  // survive is an unescaped quote that would end the attribute first.
  it('escapes quotes in kept attribute values so they cannot break out', () => {
    const out = sanitizeDescriptionHtml('<img src="https://e.com/a.png" alt=\'a" onerror="x\'>')

    expect(out).toContain('&quot;')
    expect(out).not.toMatch(/"\s*onerror\s*=/i)
    expect(out).toContain('src="https://e.com/a.png"')
  })
})

describe('sanitizeDescriptionHtml — unknown tags', () => {
  it('unwraps an unknown tag but keeps its text', () => {
    const out = sanitizeDescriptionHtml('<marquee>hello</marquee>')
    expect(out).not.toContain('marquee')
    expect(out).toContain('hello')
  })
})
