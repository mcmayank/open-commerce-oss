import { describe, expect, it } from 'vitest'
import { showsNiblrBranding } from './branding'

describe('showsNiblrBranding', () => {
  it('reads the flag the store loader decided', () => {
    expect(showsNiblrBranding({ showsPlatformBranding: true })).toBe(true)
    expect(showsNiblrBranding({ showsPlatformBranding: false })).toBe(false)
  })

  it('shows the line when there is no store', () => {
    expect(showsNiblrBranding(null)).toBe(true)
    expect(showsNiblrBranding(undefined)).toBe(true)
  })
})
