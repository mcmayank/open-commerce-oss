import { describe, it, expect } from 'vitest'
import { safeHref } from './safe-href'

describe('safeHref', () => {
  it.each([
    ['https://x.com', 'https://x.com'],
    ['http://x.com', 'http://x.com'],
    ['mailto:a@b.c', 'mailto:a@b.c'],
    ['tel:+971501234567', 'tel:+971501234567'],
    ['/products', '/products'],
    ['#top', '#top'],
    ['?q=1', '?q=1'],
    ['//cdn.example.com', '//cdn.example.com'],
  ])('passes %s through unchanged', (input, expected) => {
    expect(safeHref(input)).toBe(expected)
  })

  it.each([
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['java\tscript:alert(1)'],
    ['java\nscript:alert(1)'],
    ['data:text/html,<script>'],
    ['vbscript:x'],
    ['example.com'],
    [''],
    ['   '],
  ])('rejects %j', (input) => {
    expect(safeHref(input)).toBeUndefined()
  })

  it('rejects non-string input', () => {
    expect(safeHref(42)).toBeUndefined()
    expect(safeHref(null)).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
    expect(safeHref({})).toBeUndefined()
  })

  it('strips embedded control characters before deciding, rather than being fooled by them', () => {
    // Without the strip, `java\tscript:` would not match the disallowed
    // "javascript:" prefix textually and could slip past a naive check.
    expect(safeHref('java\tscript:alert(document.cookie)')).toBeUndefined()
    expect(safeHref('java\nscript:alert(document.cookie)')).toBeUndefined()
  })
})
