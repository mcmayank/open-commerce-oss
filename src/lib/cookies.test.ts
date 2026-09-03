import { describe, expect, it, vi, afterEach } from 'vitest'
import { cookieSecure } from './cookies'

describe('cookieSecure', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is false outside production, where the app is served over http', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(cookieSecure()).toBe(false)
  })

  it('is true in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(cookieSecure()).toBe(true)
  })

  // Regression guard for the escape hatch that used to live here: no environment
  // variable may downgrade a production cookie. The e2e suite's answer to a host
  // that cannot hold a Secure cookie is to change the host (*.localhost is a
  // secure context), never to weaken the attribute.
  it('cannot be disabled by any environment variable', () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (const name of ['E2E_ALLOW_INSECURE_COOKIES', 'ALLOW_INSECURE_COOKIES', 'CI']) {
      vi.stubEnv(name, '1')
      expect(cookieSecure(), `${name} must not disable Secure`).toBe(true)
    }
  })
})
