import { describe, it, expect } from 'vitest'
import { parseMinorExact, formatMinorExact } from './money-exact'

describe('parseMinorExact', () => {
  it('parses a two-decimal currency', () => {
    expect(parseMinorExact('12.00', 'AED')).toBe(1200)
    expect(parseMinorExact('0.99', 'USD')).toBe(99)
    expect(parseMinorExact('1234.56', 'INR')).toBe(123456)
  })

  // The reason this function exists. `* 100` silently divides every Kuwaiti
  // price by ten, and the error looks like a plausible number.
  it('parses a three-decimal currency', () => {
    expect(parseMinorExact('12.000', 'KWD')).toBe(12000)
    expect(parseMinorExact('1.500', 'BHD')).toBe(1500)
    expect(parseMinorExact('0.001', 'OMR')).toBe(1)
    expect(parseMinorExact('99.999', 'JOD')).toBe(99999)
  })

  it('parses a zero-decimal currency', () => {
    expect(parseMinorExact('1200', 'JPY')).toBe(1200)
    expect(parseMinorExact('7', 'KRW')).toBe(7)
  })

  it('pads a short fraction out to the currency exponent', () => {
    expect(parseMinorExact('12.5', 'USD')).toBe(1250)
    expect(parseMinorExact('12', 'USD')).toBe(1200)
    expect(parseMinorExact('12', 'KWD')).toBe(12000)
    expect(parseMinorExact('12.5', 'KWD')).toBe(12500)
  })

  it('handles negatives', () => {
    expect(parseMinorExact('-12.00', 'USD')).toBe(-1200)
    expect(parseMinorExact('-0.001', 'KWD')).toBe(-1)
  })

  it('handles zero without producing negative zero', () => {
    expect(parseMinorExact('0.00', 'USD')).toBe(0)
    expect(Object.is(parseMinorExact('-0.00', 'USD'), 0)).toBe(true)
  })

  // Shopify emits two decimal places regardless of currency, so a JPY store
  // reports "1200.00". Rejecting that outright would break every zero-decimal
  // import; the digits carry no value, so they are dropped rather than refused.
  it('accepts excess fraction digits when they are all zero', () => {
    expect(parseMinorExact('1200.00', 'JPY')).toBe(1200)
    expect(parseMinorExact('12.100', 'USD')).toBe(1210)
    expect(parseMinorExact('5.0000', 'KWD')).toBe(5000)
  })

  // But a non-zero digit past the currency's precision is a feed we have
  // misread. Rounding it would invent a price the merchant never set.
  it('rejects excess fraction digits that would lose value', () => {
    expect(() => parseMinorExact('12.005', 'USD')).toThrow(/precision|decimal/i)
    expect(() => parseMinorExact('1200.50', 'JPY')).toThrow(/precision|decimal/i)
    expect(() => parseMinorExact('1.0001', 'KWD')).toThrow(/precision|decimal/i)
  })

  it('rejects anything that is not a plain decimal', () => {
    const junk = [
      '1,234.56', // thousands separator
      '$12.00', // currency symbol
      '12.00 USD',
      '1.2e3', // exponent notation
      '', // empty
      '   ',
      'abc',
      '12.', // trailing separator
      '.50', // no whole part
      '12.3.4', // two separators
      '+12.00', // leading plus
      'NaN',
      'Infinity',
    ]
    for (const raw of junk) {
      expect(() => parseMinorExact(raw, 'USD'), `expected ${JSON.stringify(raw)} to throw`).toThrow()
    }
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseMinorExact('  12.00  ', 'USD')).toBe(1200)
  })

  it('refuses a value too large to hold exactly as an integer', () => {
    expect(() => parseMinorExact('999999999999999999.99', 'USD')).toThrow(/too large|safe/i)
  })

  it('is the exact inverse of formatMinorExact', () => {
    const cases: [number, string][] = [
      [1200, 'USD'],
      [99, 'USD'],
      [12000, 'KWD'],
      [1, 'OMR'],
      [1200, 'JPY'],
      [-4550, 'AED'],
      [0, 'INR'],
    ]
    for (const [minor, currency] of cases) {
      expect(parseMinorExact(formatMinorExact(minor, currency), currency)).toBe(minor)
    }
  })
})
