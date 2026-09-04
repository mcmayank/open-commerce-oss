import { describe, it, expect } from 'vitest'
import { parseMoneyInput, formatMinorForInput } from './money-input'

describe('parseMoneyInput — user string → integer minor units', () => {
  it('parses a decimal major amount to minor units', () => {
    expect(parseMoneyInput('12.50', 'USD')).toBe(1250)
  })

  it('parses a whole major amount', () => {
    expect(parseMoneyInput('10', 'USD')).toBe(1000)
  })

  it('accepts zero as a valid price', () => {
    expect(parseMoneyInput('0', 'USD')).toBe(0)
  })

  it('strips thousands separators and whitespace', () => {
    expect(parseMoneyInput(' 1,234.5 ', 'USD')).toBe(123450)
  })

  it('respects a zero-decimal currency (JPY)', () => {
    expect(parseMoneyInput('1000', 'JPY')).toBe(1000)
  })

  it('respects a three-decimal currency (KWD)', () => {
    expect(parseMoneyInput('1.5', 'KWD')).toBe(1500)
  })

  it('rounds sub-minor precision to the nearest minor unit', () => {
    expect(parseMoneyInput('12.999', 'USD')).toBe(1300)
  })

  it('returns null for an empty string', () => {
    expect(parseMoneyInput('', 'USD')).toBeNull()
  })

  it('returns null for whitespace only', () => {
    expect(parseMoneyInput('   ', 'USD')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(parseMoneyInput('abc', 'USD')).toBeNull()
  })

  it('returns null for a negative amount', () => {
    expect(parseMoneyInput('-5', 'USD')).toBeNull()
  })
})

describe('formatMinorForInput — minor units → editable major string', () => {
  it('formats minor units with the currency exponent decimals', () => {
    expect(formatMinorForInput(1250, 'USD')).toBe('12.50')
  })

  it('formats zero as a fixed-decimal string', () => {
    expect(formatMinorForInput(0, 'USD')).toBe('0.00')
  })

  it('formats a zero-decimal currency without decimals', () => {
    expect(formatMinorForInput(1000, 'JPY')).toBe('1000')
  })

  it('formats a three-decimal currency with three decimals', () => {
    expect(formatMinorForInput(1500, 'KWD')).toBe('1.500')
  })

  it('returns an empty string for null', () => {
    expect(formatMinorForInput(null, 'USD')).toBe('')
  })

  it('returns an empty string for undefined', () => {
    expect(formatMinorForInput(undefined, 'USD')).toBe('')
  })
})
