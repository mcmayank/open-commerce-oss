import { describe, expect, it } from 'vitest'
import type { StoreSetting } from '@/payload-types'
import { readEditorialConfig } from './config'

const settings = (themeCustomizations: unknown): StoreSetting =>
  ({ themeCustomizations } as unknown as StoreSetting)

describe('readEditorialConfig', () => {
  it('returns declared defaults when nothing is stored', () => {
    const cfg = readEditorialConfig(null)
    expect(cfg.heroHeadline).toBe('The New Arrivals')
    expect(cfg.accentColor).toBe('#7a1f3d')
    expect(cfg.heroStyle).toBe('full-bleed')
    expect(cfg.showLookbook).toBe(true)
    expect(cfg.galleryColumns).toBe(3)
    expect(cfg.heroImageUrl).toBeNull()
  })

  it('applies stored overrides for the editorial slug', () => {
    const cfg = readEditorialConfig(
      settings({
        editorial: {
          heroHeadline: 'Autumn Edit',
          accentColor: '#123456',
          heroStyle: 'framed',
          showLookbook: false,
          galleryColumns: 4,
          heroImageUrl: 'https://example.com/cover.jpg',
        },
      }),
    )
    expect(cfg.heroHeadline).toBe('Autumn Edit')
    expect(cfg.accentColor).toBe('#123456')
    expect(cfg.heroStyle).toBe('framed')
    expect(cfg.showLookbook).toBe(false)
    expect(cfg.galleryColumns).toBe(4)
    expect(cfg.heroImageUrl).toBe('https://example.com/cover.jpg')
  })

  it('ignores another theme’s stored config', () => {
    const cfg = readEditorialConfig(settings({ 'sd-bakery': { heroHeadline: 'nope' } }))
    expect(cfg.heroHeadline).toBe('The New Arrivals')
  })

  it('falls back to a safe value when a stored value is invalid', () => {
    const cfg = readEditorialConfig(settings({ editorial: { accentColor: 'notacolor', galleryColumns: 99 } }))
    expect(cfg.accentColor).toBe('#7a1f3d') // invalid hex → default
    expect(cfg.galleryColumns).toBe(4) // clamped to max
  })
})
