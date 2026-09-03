import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOKENS,
  SYSTEM_FONT_STACK,
  buildThemeCssVars,
  fontStack,
  presetTokens,
  resolveTokens,
} from './theme-tokens'
import type { FontAxes } from '@/lib/fonts/types'

describe('buildThemeCssVars', () => {
  it('emits the full token var set from DEFAULT_TOKENS', () => {
    const vars = buildThemeCssVars(DEFAULT_TOKENS)
    // A representative slice of the expanded set (colors, fonts, radius, space, shadow).
    expect(vars['--color-bg']).toBe('#ffffff')
    expect(vars['--color-surface']).toBe('#ffffff')
    expect(vars['--color-surface-alt']).toBe('#f9fafb')
    expect(vars['--color-text']).toBe('#111827')
    expect(vars['--color-text-muted']).toBe('#6b7280')
    expect(vars['--color-heading']).toBe('#111827')
    expect(vars['--color-primary']).toBe('#111827')
    expect(vars['--color-primary-contrast']).toBe('#ffffff')
    expect(vars['--color-accent']).toBe('#2563eb')
    expect(vars['--color-border']).toBe('#e5e7eb')
    expect(vars['--font-heading']).toBe(vars['--font-body']) // heading defaults to body
    expect(vars['--font-display']).toBe('system-ui, -apple-system, sans-serif')
    expect(vars['--radius-card']).toBe('0.75rem')
    expect(vars['--space-section']).toBe('4rem')
    expect(vars['--container-width']).toBe('80rem')
    expect(vars['--shadow-card']).toBeDefined()
  })
})

describe('resolveTokens (tenant overrides over a preset)', () => {
  it('overlays the tenant’s legacy theme settings onto the right tokens', () => {
    const t = resolveTokens(DEFAULT_TOKENS, {
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
      backgroundColor: '#eeeeee',
      textColor: '#222222',
      buttonRadius: 'full',
    })
    expect(t.colorPrimary).toBe('#ff0000')
    expect(t.colorAccent).toBe('#00ff00')
    expect(t.colorSurface).toBe('#eeeeee')
    expect(t.colorText).toBe('#222222')
    expect(t.radiusButton).toBe('9999px')
  })

  it('keeps the preset value when an override is missing or an invalid hex', () => {
    const t = resolveTokens(DEFAULT_TOKENS, { primaryColor: 'not-a-hex', accentColor: null })
    expect(t.colorPrimary).toBe('#111827') // invalid → preset default
    expect(t.colorAccent).toBe('#2563eb') // null → preset default
  })

  it('drives heading color from the legacy textColor so headings never mismatch body text', () => {
    const t = resolveTokens(DEFAULT_TOKENS, { textColor: '#f5f5f5' })
    expect(t.colorText).toBe('#f5f5f5')
    expect(t.colorHeading).toBe('#f5f5f5')
  })
})

describe('presetTokens (theme preset over defaults)', () => {
  it('returns the defaults when no preset is given', () => {
    expect(presetTokens(undefined)).toEqual(DEFAULT_TOKENS)
    expect(presetTokens(null)).toBe(DEFAULT_TOKENS)
  })

  it('overlays only the tokens the preset specifies', () => {
    const t = presetTokens({ colorPrimary: '#7a1f3d', fontHeading: '"Merriweather", serif' })
    expect(t.colorPrimary).toBe('#7a1f3d')
    expect(t.fontHeading).toBe('"Merriweather", serif')
    expect(t.colorAccent).toBe(DEFAULT_TOKENS.colorAccent) // untouched
  })

  it('composes with resolveTokens so a tenant override still wins over the preset', () => {
    const withPreset = presetTokens({ colorPrimary: '#7a1f3d' })
    const resolved = resolveTokens(withPreset, { primaryColor: '#00ff00' })
    expect(resolved.colorPrimary).toBe('#00ff00') // tenant override beats preset
  })
})

describe('inheritance: an absent setting yields the preset', () => {
  const preset = {
    ...DEFAULT_TOKENS,
    colorPrimary: '#16151a',
    colorAccent: '#7a1f3d',
    colorSurface: '#fffdf8',
    colorText: '#1a1a1a',
    colorHeading: '#1a1a1a',
    radiusButton: '0',
    fontBody: '"Jost", system-ui, sans-serif',
  }

  // Each of the three ways a value can be absent must behave identically.
  for (const [label, empty] of [
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ] as const) {
    it(`falls back to the preset when every setting is ${label}`, () => {
      const t = resolveTokens(preset, {
        primaryColor: empty,
        accentColor: empty,
        backgroundColor: empty,
        textColor: empty,
        fontFamily: empty,
        buttonRadius: empty,
      })
      expect(t.colorPrimary).toBe('#16151a')
      expect(t.colorAccent).toBe('#7a1f3d')
      expect(t.colorSurface).toBe('#fffdf8')
      expect(t.colorText).toBe('#1a1a1a')
      expect(t.radiusButton).toBe('0')
      expect(t.fontBody).toBe('"Jost", system-ui, sans-serif')
    })
  }

  it('lets an explicitly set value win over the preset', () => {
    const t = resolveTokens(preset, { accentColor: '#00ff00', buttonRadius: 'full' })
    expect(t.colorAccent).toBe('#00ff00')
    expect(t.radiusButton).toBe('9999px')
    // Untouched fields still inherit.
    expect(t.colorPrimary).toBe('#16151a')
  })

  it('keeps textColor driving both body and heading colour', () => {
    const t = resolveTokens(preset, { textColor: '#333333' })
    expect(t.colorText).toBe('#333333')
    expect(t.colorHeading).toBe('#333333')
  })

  it('falls back to the preset on an invalid hex rather than emitting it', () => {
    const t = resolveTokens(preset, { accentColor: 'not-a-colour' })
    expect(t.colorAccent).toBe('#7a1f3d')
  })
})

const axesFor = (category: FontAxes['category']): FontAxes => ({
  category,
  hasItalic: false,
  variable: true,
  min: 100,
  max: 900,
})

describe('fontStack', () => {
  it('falls back when no family is set', () => {
    expect(fontStack(null, null, 'FALLBACK')).toBe('FALLBACK')
  })

  it('returns the native stack for the system sentinel', () => {
    expect(fontStack('system', null, 'FALLBACK')).toBe(SYSTEM_FONT_STACK)
  })

  it('quotes the family and appends a sans fallback tail', () => {
    expect(fontStack('Inter', axesFor('sans-serif'), 'FALLBACK')).toBe(
      '"Inter", system-ui, sans-serif',
    )
  })

  it('appends a serif tail for a serif family', () => {
    expect(fontStack('Lora', axesFor('serif'), 'FALLBACK')).toBe('"Lora", Georgia, serif')
  })

  it('appends a monospace tail for a monospace family', () => {
    expect(fontStack('Space Mono', axesFor('monospace'), 'FALLBACK')).toBe(
      '"Space Mono", ui-monospace, monospace',
    )
  })

  it('treats display and handwriting as sans for fallback purposes', () => {
    expect(fontStack('Lobster', axesFor('display'), 'FALLBACK')).toBe(
      '"Lobster", system-ui, sans-serif',
    )
    expect(fontStack('Dancing Script', axesFor('handwriting'), 'FALLBACK')).toBe(
      '"Dancing Script", system-ui, sans-serif',
    )
  })

  it('defaults to a sans tail when the axes snapshot is missing', () => {
    // A store written before the axes column existed, or by a direct SQL write.
    // It must still render the family, not fall back to the preset.
    expect(fontStack('Inter', null, 'FALLBACK')).toBe('"Inter", system-ui, sans-serif')
  })

  // `axes` is typed `unknown` at this boundary (Payload generates the two axes
  // columns as generic JSON, not FontAxes — see LegacyThemeSettings' doc
  // comment), so a malformed value must degrade to the sans tail rather than
  // throwing or emitting a broken stack. Paired with the correct-category
  // cases above as the positive control.
  it('degrades to a sans tail rather than throwing when axes is a malformed shape', () => {
    expect(fontStack('Lora', 'not-an-object', 'FALLBACK')).toBe('"Lora", system-ui, sans-serif')
    expect(fontStack('Lora', { category: 'not-a-real-category' }, 'FALLBACK')).toBe(
      '"Lora", system-ui, sans-serif',
    )
    expect(fontStack('Lora', ['serif'], 'FALLBACK')).toBe('"Lora", system-ui, sans-serif')
    expect(fontStack('Lora', 42, 'FALLBACK')).toBe('"Lora", system-ui, sans-serif')
  })
})

describe('resolveTokens with family names', () => {
  it('uses the tenant’s chosen families over the preset', () => {
    const t = resolveTokens(DEFAULT_TOKENS, {
      fontFamily: 'Inter',
      fontFamilyAxes: axesFor('sans-serif'),
      headingFont: 'Lora',
      headingFontAxes: axesFor('serif'),
    })
    expect(t.fontBody).toBe('"Inter", system-ui, sans-serif')
    expect(t.fontHeading).toBe('"Lora", Georgia, serif')
  })

  it('keeps the preset’s fonts when the tenant has set none', () => {
    const t = resolveTokens(DEFAULT_TOKENS, { fontFamily: null, headingFont: null })
    expect(t.fontBody).toBe(DEFAULT_TOKENS.fontBody)
    expect(t.fontHeading).toBe(DEFAULT_TOKENS.fontHeading)
  })
})

describe('resolveTokens: fontDisplay (third font role)', () => {
  it('carries the tenant’s chosen display font from settings', () => {
    const t = resolveTokens(DEFAULT_TOKENS, {
      displayFont: 'Lobster',
      displayFontAxes: axesFor('display'),
    })
    expect(t.fontDisplay).toBe('"Lobster", system-ui, sans-serif')
  })

  it('falls back to the resolved heading font when displayFont is unset', () => {
    const t = resolveTokens(DEFAULT_TOKENS, {
      headingFont: 'Lora',
      headingFontAxes: axesFor('serif'),
    })
    expect(t.fontHeading).toBe('"Lora", Georgia, serif')
    expect(t.fontDisplay).toBe(t.fontHeading)
  })

  it('falls back to heading (not the preset’s own fontDisplay) when both are unset', () => {
    const preset = { ...DEFAULT_TOKENS, fontHeading: '"Preset Heading", serif', fontDisplay: '"Preset Display", serif' }
    const t = resolveTokens(preset, {})
    expect(t.fontDisplay).toBe('"Preset Heading", serif')
  })

  it('lets an explicit displayFont win even when headingFont is also set', () => {
    const t = resolveTokens(DEFAULT_TOKENS, {
      headingFont: 'Lora',
      headingFontAxes: axesFor('serif'),
      displayFont: 'Lobster',
      displayFontAxes: axesFor('display'),
    })
    expect(t.fontDisplay).toBe('"Lobster", system-ui, sans-serif')
  })
})
