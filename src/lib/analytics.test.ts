// src/lib/analytics.test.ts
import { describe, it, expect } from 'vitest'
import { GA4_ID_RE, GTM_ID_RE, toMajor, readAnalytics } from './analytics'

describe('analytics helpers', () => {
  it('validates GA4 + GTM id formats', () => {
    expect(GA4_ID_RE.test('G-ABCDE12345')).toBe(true)
    expect(GA4_ID_RE.test('UA-123')).toBe(false)
    expect(GTM_ID_RE.test('GTM-ABC123')).toBe(true)
    expect(GTM_ID_RE.test('G-ABCDE')).toBe(false)
  })

  it('converts minor units to major decimal', () => {
    expect(toMajor(1000)).toBe(10)
    expect(toMajor(1599)).toBe(15.99)
    expect(toMajor(0)).toBe(0)
  })

  it('reads + validates stored ids, dropping malformed ones', () => {
    expect(readAnalytics({ ga4MeasurementId: 'G-ABCDE12345', gtmContainerId: 'GTM-XYZ9' }))
      .toEqual({ ga4MeasurementId: 'G-ABCDE12345', gtmContainerId: 'GTM-XYZ9' })
    expect(readAnalytics({ ga4MeasurementId: 'bogus', gtmContainerId: 'nope' })).toEqual({})
    expect(readAnalytics({ ga4MeasurementId: '  G-TRIMME12  ' })).toEqual({ ga4MeasurementId: 'G-TRIMME12' })
    expect(readAnalytics(null)).toEqual({})
    expect(readAnalytics(undefined)).toEqual({})
  })
})
