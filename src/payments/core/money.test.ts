import { describe, expect, it } from 'vitest'
import { currencyExponent, fromMinor, toMinor, formatMoney } from './money'

describe('currencyExponent', () => {
  it('defaults to 2 for common currencies', () => {
    expect(currencyExponent('USD')).toBe(2)
    expect(currencyExponent('INR')).toBe(2)
    expect(currencyExponent('EUR')).toBe(2)
  })
  it('is 0 for zero-decimal currencies (JPY, KRW, VND)', () => {
    expect(currencyExponent('JPY')).toBe(0)
    expect(currencyExponent('KRW')).toBe(0)
    expect(currencyExponent('VND')).toBe(0)
  })
  it('is 3 for three-decimal currencies (KWD, BHD, OMR, JOD, TND)', () => {
    expect(currencyExponent('KWD')).toBe(3)
    expect(currencyExponent('BHD')).toBe(3)
    expect(currencyExponent('OMR')).toBe(3)
    expect(currencyExponent('JOD')).toBe(3)
    expect(currencyExponent('TND')).toBe(3)
  })
  it('is case-insensitive', () => {
    expect(currencyExponent('jpy')).toBe(0)
    expect(currencyExponent('kwd')).toBe(3)
  })
})

describe('fromMinor / toMinor round-trip', () => {
  it('2-decimal: 1234 minor USD = 12.34', () => {
    expect(fromMinor(1234, 'USD')).toBe(12.34)
    expect(toMinor(12.34, 'USD')).toBe(1234)
  })
  it('0-decimal: 1000 minor JPY = 1000', () => {
    expect(fromMinor(1000, 'JPY')).toBe(1000)
    expect(toMinor(1000, 'JPY')).toBe(1000)
  })
  it('3-decimal: 1000 minor KWD = 1.000', () => {
    expect(fromMinor(1000, 'KWD')).toBe(1)
    expect(toMinor(1, 'KWD')).toBe(1000)
  })
  it('rounds to the nearest minor unit', () => {
    expect(toMinor(9.999, 'USD')).toBe(1000)
  })
})

describe('formatMoney (preserves existing behaviour + exponent-aware)', () => {
  it('formats INR minor units', () => {
    expect(formatMoney(123450, 'INR')).toBe('₹1,234.50')
  })
  it('formats USD', () => {
    expect(formatMoney(999, 'USD')).toBe('$9.99')
  })
  it('handles zero', () => {
    expect(formatMoney(0, 'INR')).toBe('₹0.00')
  })
  it('formats zero-decimal JPY with no fraction digits', () => {
    expect(formatMoney(1000, 'JPY')).toBe('¥1,000')
  })
})
