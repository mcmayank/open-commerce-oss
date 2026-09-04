import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyCronAuth } from './cron'

const mk = (opts: { header?: string; bearer?: string; query?: string }) => {
  const url = new URL('https://x.test/api/cron' + (opts.query ? `?secret=${opts.query}` : ''))
  const headers = new Headers()
  if (opts.header) headers.set('x-cron-secret', opts.header)
  if (opts.bearer) headers.set('authorization', `Bearer ${opts.bearer}`)
  return new NextRequest(url, { headers })
}

afterEach(() => { delete process.env.CRON_SECRET })

describe('verifyCronAuth', () => {
  it('denies when CRON_SECRET is unset', () => {
    const r = verifyCronAuth(mk({ header: 'x' }))
    expect(r).toEqual({ ok: false, status: 401, error: 'CRON_SECRET not configured' })
  })
  it('accepts x-cron-secret header', () => {
    process.env.CRON_SECRET = 'sekret'
    expect(verifyCronAuth(mk({ header: 'sekret' }))).toEqual({ ok: true })
  })
  it('accepts Authorization: Bearer', () => {
    process.env.CRON_SECRET = 'sekret'
    expect(verifyCronAuth(mk({ bearer: 'sekret' }))).toEqual({ ok: true })
  })
  it('accepts ?secret= query', () => {
    process.env.CRON_SECRET = 'sekret'
    expect(verifyCronAuth(mk({ query: 'sekret' }))).toEqual({ ok: true })
  })
  it('rejects a wrong secret', () => {
    process.env.CRON_SECRET = 'sekret'
    expect(verifyCronAuth(mk({ header: 'nope' }))).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })
  it('rejects a length-mismatched secret without throwing', () => {
    process.env.CRON_SECRET = 'sekret'
    expect(verifyCronAuth(mk({ header: 'x' })).ok).toBe(false)
  })
})
