import { describe, expect, it } from 'vitest'
import { tagFromParam, tagPath } from './blog-paths'

describe('blog tag paths', () => {
  it('encodes multi-word tags into a valid path segment', () => {
    expect(tagPath('build in public')).toBe('/blog/tag/build%20in%20public')
    expect(tagPath('payments')).toBe('/blog/tag/payments')
  })

  it('round-trips through the route param', () => {
    for (const tag of ['build in public', 'ai', 'c++ & rust', 'ünïcode']) {
      const segment = tagPath(tag).split('/').pop()!
      expect(tagFromParam(segment)).toBe(tag)
    }
  })
})
