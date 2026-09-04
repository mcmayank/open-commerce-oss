import { describe, it, expect } from 'vitest'
import { formatMinorExact } from './money'

describe('formatMinorExact', () => {
  it('formats two-decimal currencies', () => {
    expect(formatMinorExact(1250, 'AED')).toBe('12.50')
    expect(formatMinorExact(5, 'AED')).toBe('0.05')
    expect(formatMinorExact(0, 'AED')).toBe('0.00')
    expect(formatMinorExact(-350, 'AED')).toBe('-3.50')
  })

  // BHD, IQD, JOD, KWD, LYD, OMR, TND. Three are Gulf currencies, in a
  // primary market — hardcoding 2 would render 1250 fils as 12.50.
  it('formats three-decimal currencies', () => {
    expect(formatMinorExact(1250, 'KWD')).toBe('1.250')
    expect(formatMinorExact(5, 'BHD')).toBe('0.005')
  })

  it('formats zero-decimal currencies without a point', () => {
    expect(formatMinorExact(1250, 'JPY')).toBe('1250')
    expect(formatMinorExact(0, 'JPY')).toBe('0')
  })

  it('is case-insensitive about the currency code', () => {
    expect(formatMinorExact(1250, 'aed')).toBe('12.50')
  })

  // The whole reason this function exists instead of reusing fromMinor.
  //
  // Deviation from the task brief: the brief's literal (100000000000000010)
  // exceeds Number.MAX_SAFE_INTEGER, so it is already rounded by the JS
  // parser to 100000000000000020 before formatMinorExact ever runs — no
  // implementation taking a `number` can recover the lost digit. Using
  // Number.MAX_SAFE_INTEGER - 4 keeps the input an exactly-representable
  // safe integer while still showing float division landing on the wrong
  // digit that exact string-shifting avoids.
  it('stays exact where float division does not', () => {
    const minor = Number.MAX_SAFE_INTEGER - 4
    expect(formatMinorExact(minor, 'AED')).toBe('90071992547409.87')
    expect(String(minor / 100)).not.toBe('90071992547409.87')
  })

  it('rejects a non-integer, which would mean minor units were already lost', () => {
    expect(() => formatMinorExact(12.5, 'AED')).toThrow(/integer minor units/)
  })
})
