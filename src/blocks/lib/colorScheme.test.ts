import { describe, expect, it } from 'vitest'
import { sectionVars, type SectionScheme } from './colorScheme'

describe('sectionVars', () => {
  it('maps the muted scheme to the surface-alt band with normal text', () => {
    const v = sectionVars('muted') as Record<string, string>
    expect(v['--section-bg']).toBe('var(--color-surface-alt)')
    expect(v['--section-fg']).toBe('var(--color-text)')
    expect(v['--section-heading']).toBe('var(--color-heading)')
    expect(v.background).toBe('var(--section-bg)')
    expect(v.color).toBe('var(--section-fg)')
  })

  it('maps the inverse scheme to the primary band with contrast text', () => {
    const v = sectionVars('inverse') as Record<string, string>
    expect(v['--section-bg']).toBe('var(--color-primary)')
    expect(v['--section-fg']).toBe('var(--color-primary-contrast)')
    expect(v['--section-heading']).toBe('var(--color-primary-contrast)')
    expect(v.background).toBe('var(--section-bg)')
  })

  it('maps the accent scheme to the accent band with contrast text', () => {
    const v = sectionVars('accent') as Record<string, string>
    expect(v['--section-bg']).toBe('var(--color-accent)')
    expect(v['--section-fg']).toBe('var(--color-primary-contrast)')
  })

  it('does NOT force a background on the default scheme (blocks inherit the page)', () => {
    const v = sectionVars('default') as Record<string, string>
    expect(v['--section-bg']).toBe('var(--color-bg)')
    expect(v['--section-fg']).toBe('var(--color-text)')
    expect(v.background).toBeUndefined()
    expect(v.color).toBeUndefined()
  })

  it('always defines the section text tokens so blocks can rely on them', () => {
    for (const s of ['default', 'muted', 'inverse', 'accent'] as SectionScheme[]) {
      const v = sectionVars(s) as Record<string, string>
      expect(v['--section-fg']).toBeTruthy()
      expect(v['--section-muted']).toBeTruthy()
      expect(v['--section-heading']).toBeTruthy()
    }
  })
})
