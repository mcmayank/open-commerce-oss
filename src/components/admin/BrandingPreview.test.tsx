// @vitest-environment jsdom
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TOKENS, presetTokens, resolveTokens } from '@/lib/theme-tokens'

type FieldState = Record<string, { value?: unknown } | undefined>

let fieldState: FieldState = {}

// Same mocking pattern as SlugField.test.tsx: useFormFields' selector receives
// [fields, dispatch] and BrandingPreview calls useFormFields(([f]) => f).
vi.mock('@payloadcms/ui', () => ({
  useFormFields: (selector: (args: [FieldState, unknown]) => unknown) =>
    selector([{ ...fieldState }, () => {}]),
}))

// Mirrors ColorField.test.tsx: fix the "active theme" preset so the assertions
// below are pinned against DEFAULT_TOKENS, not a live network fetch.
vi.mock('./useThemePreset', () => ({
  useThemePreset: () => ({ tokens: DEFAULT_TOKENS, loading: false }),
}))

const mod = await import('./BrandingPreview')
const BrandingPreview = mod.default as unknown as React.FC

afterEach(() => {
  cleanup()
  fieldState = {}
})

/**
 * The preview spreads the full `buildThemeCssVars` map onto one inner div's
 * inline style (see BrandingPreview.tsx), including `--font-body` and
 * `--font-heading` even though only `--font-body` is read directly inline.
 * Find that div rather than assuming a fixed DOM depth.
 */
function findVarsDiv(container: HTMLElement): HTMLElement {
  const el = Array.from(container.querySelectorAll('div')).find(
    (d) => d.style.getPropertyValue('--font-body') !== '',
  )
  if (!el) throw new Error('expected to find the div carrying the theme CSS vars')
  return el
}

describe('BrandingPreview font stacks', () => {
  // The regression this fix closes: BrandingPreview used to build its
  // `settings` object from `theme.fontFamily`/`theme.headingFont` only, never
  // reading `theme.fontFamilyAxes`/`theme.headingFontAxes`. Every non-sans
  // family (serif, monospace, display, handwriting) then silently rendered
  // with a sans fallback tail here while StoreTheme.tsx — which forwards the
  // whole settings object, axes included — rendered the correct one. These
  // tests exercise the real component tree end to end (mocking only the
  // Payload form context and the network-backed preset hook), so a dropped
  // field would fail them exactly as it broke production.
  it('renders the same serif fallback tail as the storefront for a serif family', () => {
    fieldState = {
      'theme.fontFamily': { value: 'Lora' },
      'theme.fontFamilyAxes': {
        value: { category: 'serif', hasItalic: false, variable: true, min: 400, max: 700 },
      },
    }
    const { container } = render(<BrandingPreview />)
    const el = findVarsDiv(container)
    expect(el.style.getPropertyValue('--font-body')).toBe('"Lora", Georgia, serif')
  })

  it('renders the same monospace fallback tail as the storefront for a heading family', () => {
    fieldState = {
      'theme.headingFont': { value: 'Space Mono' },
      'theme.headingFontAxes': {
        value: { category: 'monospace', hasItalic: false, variable: false, weights: ['400', '700'] },
      },
    }
    const { container } = render(<BrandingPreview />)
    const el = findVarsDiv(container)
    expect(el.style.getPropertyValue('--font-heading')).toBe('"Space Mono", ui-monospace, monospace')
  })

  it('agrees with resolveTokens(presetTokens(preset), theme) — the exact path StoreTheme.tsx renders through', () => {
    // A theme object shaped exactly like StoreSetting.theme, forwarded whole
    // the way StoreTheme.tsx does it (the source of truth for "what ships").
    const theme = {
      fontFamily: 'Lora',
      fontFamilyAxes: { category: 'serif' as const, hasItalic: false, variable: true, min: 400, max: 700 },
      headingFont: 'Dancing Script',
      headingFontAxes: { category: 'handwriting' as const, hasItalic: false, variable: false, weights: ['400'] },
    }
    const expected = resolveTokens(presetTokens(DEFAULT_TOKENS), theme)

    fieldState = {
      'theme.fontFamily': { value: theme.fontFamily },
      'theme.fontFamilyAxes': { value: theme.fontFamilyAxes },
      'theme.headingFont': { value: theme.headingFont },
      'theme.headingFontAxes': { value: theme.headingFontAxes },
    }
    const { container } = render(<BrandingPreview />)
    const el = findVarsDiv(container)
    expect(el.style.getPropertyValue('--font-body')).toBe(expected.fontBody)
    expect(el.style.getPropertyValue('--font-heading')).toBe(expected.fontHeading)
    // Presence guard: both must be non-empty, category-shaped stacks, not an
    // accidental match on two empty strings.
    expect(expected.fontBody).toBe('"Lora", Georgia, serif')
    expect(expected.fontHeading).toBe('"Dancing Script", system-ui, sans-serif')
  })

  it('still inherits the preset font when no family is set', () => {
    fieldState = {}
    const { container } = render(<BrandingPreview />)
    const el = findVarsDiv(container)
    expect(el.style.getPropertyValue('--font-body')).toBe(DEFAULT_TOKENS.fontBody)
  })
})
