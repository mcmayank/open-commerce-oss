import { describe, expect, it } from 'vitest'
import { ADMIN_SOURCE, scopeClientHintsToAdmin } from './client-hint-headers'

// The exact shape @payloadcms/next's withPayload() appends (v3): one catch-all
// rule carrying the colour-scheme client hints and X-Powered-By.
const payloadRule = {
  source: '/:path*',
  headers: [
    { key: 'Accept-CH', value: 'Sec-CH-Prefers-Color-Scheme' },
    { key: 'Vary', value: 'Sec-CH-Prefers-Color-Scheme' },
    { key: 'Critical-CH', value: 'Sec-CH-Prefers-Color-Scheme' },
    { key: 'X-Powered-By', value: 'Next.js, Payload' },
  ],
}

const mediaCacheRule = {
  source: '/api/media/file/:path*',
  headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
}

describe('scopeClientHintsToAdmin', () => {
  it('moves the Critical-CH rule from every path to the admin only', () => {
    const out = scopeClientHintsToAdmin([mediaCacheRule, payloadRule])

    const hintRules = out.filter((r) => r.headers.some((h) => h.key === 'Critical-CH'))
    expect(hintRules).toHaveLength(1)
    expect(hintRules[0].source).toBe(ADMIN_SOURCE)
    // The rule itself is preserved, only its scope changes.
    expect(hintRules[0].headers).toEqual(payloadRule.headers)
  })

  it('leaves rules without client hints exactly as they were', () => {
    const out = scopeClientHintsToAdmin([mediaCacheRule, payloadRule])
    expect(out[0]).toBe(mediaCacheRule)
  })

  it('is idempotent and case-insensitive on the header key', () => {
    const lower = { source: '/:path*', headers: [{ key: 'critical-ch', value: 'x' }] }
    const once = scopeClientHintsToAdmin([lower])
    const twice = scopeClientHintsToAdmin(once)
    expect(once[0].source).toBe(ADMIN_SOURCE)
    expect(twice[0]).toBe(once[0])
  })

  it('never emits a catch-all rule that demands the hint', () => {
    const out = scopeClientHintsToAdmin([payloadRule])
    const publicHint = out.find(
      (r) => r.source === '/:path*' && r.headers.some((h) => h.key === 'Critical-CH'),
    )
    expect(publicHint).toBeUndefined()
  })
})
