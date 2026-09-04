import { describe, expect, it } from 'vitest'
import { buildMetadata } from './seo'

describe('buildMetadata', () => {
  it('defaults the canonical to the page url', () => {
    expect(buildMetadata({ title: 't', url: 'https://x.test/p' }).alternates?.canonical).toBe(
      'https://x.test/p',
    )
  })
})
