import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  it('formats INR minor units', () => {
    expect(formatMoney(123450, 'INR')).toBe('₹1,234.50')
  })
  it('formats USD', () => {
    expect(formatMoney(999, 'USD')).toBe('$9.99')
  })
  it('handles zero', () => {
    expect(formatMoney(0, 'INR')).toBe('₹0.00')
  })
})
