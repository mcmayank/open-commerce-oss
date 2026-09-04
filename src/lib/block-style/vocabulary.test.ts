// src/lib/block-style/vocabulary.test.ts
import { describe, it, expect } from 'vitest'
import { varsForStyle, BLOCK_STYLE_VOCAB } from './vocabulary'

describe('per-role typography scales', () => {
  const valuesOf = (group: 'eyebrow' | 'heading' | 'subheading', control: 'size' | 'weight') =>
    BLOCK_STYLE_VOCAB[group][control].options.map((o) => o.value)

  it('offers headings only display sizes — never the body/label end of the scale', () => {
    expect(valuesOf('heading', 'size')).toEqual(['xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'])
  })

  it('caps eyebrows at large, and subheadings below display sizes', () => {
    expect(valuesOf('eyebrow', 'size')).toEqual(['xs', 'sm', 'base', 'lg'])
    expect(valuesOf('subheading', 'size')).toEqual(['sm', 'base', 'lg', 'xl'])
  })

  it('prunes weights per role: no Light on an eyebrow, nothing above Medium on body copy', () => {
    expect(valuesOf('heading', 'weight')).toEqual(['300', '400', '600', '700'])
    expect(valuesOf('eyebrow', 'weight')).toEqual(['400', '500', '600'])
    expect(valuesOf('subheading', 'weight')).toEqual(['300', '400', '500'])
  })

  // The compatibility guarantee that makes pruning safe. Production stores
  // `heading.size: '3xl'` and `eyebrow.size: 'xs'` today; a value dropped from a
  // role's OPTIONS must still render, or those pages would emit
  // `--bs-heading-size: undefined` the moment this shipped.
  it('still renders a stored value that its role no longer offers', () => {
    expect(valuesOf('heading', 'size')).not.toContain('sm')
    expect(varsForStyle({ heading: { size: 'sm' } })['--bs-heading-size']).toBe('.875rem')

    expect(valuesOf('eyebrow', 'weight')).not.toContain('800')
    expect(varsForStyle({ eyebrow: { weight: '800' } })['--bs-eyebrow-weight']).toBe('800')
  })

  // Fluid above lg — a fixed 8rem heading is 128px on a 390px phone.
  it('emits fluid sizes above lg and fixed ones below', () => {
    expect(varsForStyle({ heading: { size: '7xl' } })['--bs-heading-size']).toBe(
      'clamp(2.5rem, 8vw, 8rem)',
    )
    expect(varsForStyle({ eyebrow: { size: 'xs' } })['--bs-eyebrow-size']).toBe('.75rem')
  })
})

describe('varsForStyle', () => {
  it('maps typography enums to --bs-* vars', () => {
    const v = varsForStyle({ heading: { size: 'xl', weight: '800', font: 'display', italic: 'on' } })
    expect(v['--bs-heading-size']).toBe('clamp(1.5rem, 3vw, 1.875rem)')
    expect(v['--bs-heading-weight']).toBe('800')
    expect(v['--bs-heading-font']).toBe('var(--font-display)')
    expect(v['--bs-heading-style']).toBe('italic')
  })
  it('maps the new 3xl size', () => {
    expect(varsForStyle({ heading: { size: '3xl' } })['--bs-heading-size']).toBe('clamp(1.75rem, 4.5vw, 3rem)')
  })
  it('maps media radius/shadow/blend (multiply|overlay only)', () => {
    const v = varsForStyle({ media: { radius: 'lg', shadow: 'md', blend: 'multiply' } })
    expect(v['--bs-media-radius']).toBe('1.5rem')
    expect(v['--bs-media-shadow']).toBeTruthy()
    expect(v['--bs-media-blend']).toBe('multiply')
  })
  it('maps media blend "none" to the valid CSS keyword "normal" (mix-blend-mode: none is invalid)', () => {
    expect(varsForStyle({ media: { blend: 'none' } })['--bs-media-blend']).toBe('normal')
  })
  it('on/off controls emit the neutral CSS value on "off", not the "on" value', () => {
    expect(varsForStyle({ heading: { uppercase: 'off' } })['--bs-heading-transform']).toBe('none')
    expect(varsForStyle({ heading: { italic: 'off' } })['--bs-heading-style']).toBe('normal')
    expect(varsForStyle({ eyebrow: { uppercase: 'off' } })['--bs-eyebrow-transform']).toBe('none')
    expect(varsForStyle({ eyebrow: { italic: 'off' } })['--bs-eyebrow-style']).toBe('normal')
    expect(varsForStyle({ subheading: { uppercase: 'off' } })['--bs-subheading-transform']).toBe(
      'none',
    )
    expect(varsForStyle({ subheading: { italic: 'off' } })['--bs-subheading-style']).toBe('normal')
    expect(varsForStyle({ accent: { italic: 'off' } })['--bs-accent-style']).toBe('normal')
  })
  it('on/off controls still emit the "on" CSS value when set to "on"', () => {
    expect(varsForStyle({ heading: { uppercase: 'on' } })['--bs-heading-transform']).toBe(
      'uppercase',
    )
    expect(varsForStyle({ accent: { italic: 'on' } })['--bs-accent-style']).toBe('italic')
  })
  it('omits vars for unset controls (fallback to block default)', () => {
    expect('--bs-heading-size' in varsForStyle({ heading: {} })).toBe(false)
    expect(Object.keys(varsForStyle({})).length).toBe(0)
  })
  it('rejects blend values outside multiply/overlay (vocab has exactly those)', () => {
    const blend = BLOCK_STYLE_VOCAB.media.blend.options.map((o) => o.value)
    expect(blend).toEqual(['none', 'multiply', 'overlay'])
  })

  it('structural controls (eyebrow.treatment, media.layout) emit a var bundle, not a single var', () => {
    const pill = varsForStyle({ eyebrow: { treatment: 'pill' } })
    expect(pill['--bs-eyebrow-treatment-bg']).toContain('var(--color-accent)')
    expect(pill['--bs-eyebrow-treatment-pad']).toBeTruthy()
    expect(pill['--bs-eyebrow-treatment-radius']).toBe('9999px')
    expect(pill['--bs-eyebrow-treatment-transform']).toBe('uppercase')

    const plainCaps = varsForStyle({ eyebrow: { treatment: 'plain-caps' } })
    expect(plainCaps['--bs-eyebrow-treatment-bg']).toBe('transparent')
    expect(plainCaps['--bs-eyebrow-treatment-radius']).toBe('0')
    expect(plainCaps['--bs-eyebrow-treatment-transform']).toBe('uppercase')

    const plain = varsForStyle({ eyebrow: { treatment: 'plain' } })
    expect(plain['--bs-eyebrow-treatment-transform']).toBe('none')

    const inset = varsForStyle({ media: { layout: 'inset' } })
    expect(inset['--bs-media-layout-pad']).toBe('1.5rem')
    expect(inset['--bs-media-layout-radius']).toBe('1.5rem')

    const fullBleed = varsForStyle({ media: { layout: 'full-bleed' } })
    expect(fullBleed['--bs-media-layout-pad']).toBe('0')
    expect(fullBleed['--bs-media-layout-radius']).toBe('0')
  })

  it('reconciled media shadow presets match the approved mockup', () => {
    const v = varsForStyle({ media: { shadow: 'sm' } })
    expect(v['--bs-media-shadow']).toBe('0 2px 6px rgba(30,25,15,.14)')
    expect(varsForStyle({ media: { shadow: 'md' } })['--bs-media-shadow']).toBe(
      '0 12px 26px -10px rgba(30,25,15,.35)',
    )
    expect(varsForStyle({ media: { shadow: 'lg' } })['--bs-media-shadow']).toBe(
      '0 26px 50px -16px rgba(30,25,15,.5)',
    )
  })
})
