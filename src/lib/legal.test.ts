import { describe, expect, it } from 'vitest'
import { CURRENT_TERMS_VERSION } from './legal'

describe('CURRENT_TERMS_VERSION', () => {
  it('is a YYYY-MM-DD version string', () => {
    expect(CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
