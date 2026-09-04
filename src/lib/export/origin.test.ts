import { describe, it, expect } from 'vitest'
import { requestOrigin } from './origin'

const headers = (h: Record<string, string> = {}) => new Headers(h)

describe('requestOrigin', () => {
  it('defaults to https for a public host', () => {
    expect(requestOrigin(headers(), 'sdbakery.ae')).toBe('https://sdbakery.ae')
  })

  // A store on a custom domain must get its custom domain, not the
  // slug.niblr.store subdomain, so the links match the address the merchant
  // is looking at.
  it('uses the host it was given, including a custom domain', () => {
    expect(requestOrigin(headers(), 'aurora.niblr.store')).toBe('https://aurora.niblr.store')
    expect(requestOrigin(headers(), 'shop.example.co.uk')).toBe('https://shop.example.co.uk')
  })

  it('honours x-forwarded-proto when the proxy sets it', () => {
    expect(requestOrigin(headers({ 'x-forwarded-proto': 'http' }), 'sdbakery.ae')).toBe(
      'http://sdbakery.ae',
    )
    expect(requestOrigin(headers({ 'x-forwarded-proto': 'https' }), 'localhost:3000')).toBe(
      'https://localhost:3000',
    )
  })

  it('uses http for local dev hosts, which have no TLS', () => {
    expect(requestOrigin(headers(), 'localhost:3000')).toBe('http://localhost:3000')
    expect(requestOrigin(headers(), 'aurora.lvh.me:3000')).toBe('http://aurora.lvh.me:3000')
    expect(requestOrigin(headers(), '127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
  })

  // The single-store build resolves its store without consulting the host, so
  // a null host can still reach a successful export.
  // Emitting `https://null/...` into every image cell would be worse than
  // leaving the path relative.
  it('returns an empty origin rather than a bogus one when there is no host', () => {
    expect(requestOrigin(headers(), null)).toBe('')
    expect(requestOrigin(headers(), '')).toBe('')
  })
})
