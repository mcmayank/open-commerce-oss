import { describe, expect, it } from 'vitest'
import { buildPremiumHomeLayout } from './premium-home'

describe('buildPremiumHomeLayout', () => {
  it('returns a splitHero block with a valid variant and the store name', () => {
    const layout = buildPremiumHomeLayout({ name: 'Acme Co' })
    expect(layout[0].blockType).toBe('splitHero')
    expect(['mediaLeft', 'mediaRight', 'overlay', 'stacked']).toContain(layout[0].variant)
    expect(JSON.stringify(layout)).toContain('Acme Co')
  })
})
