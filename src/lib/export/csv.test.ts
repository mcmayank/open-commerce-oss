import { describe, it, expect } from 'vitest'
import { escapeField, toCsv } from './csv'

describe('escapeField', () => {
  it('passes plain values through unchanged', () => {
    expect(escapeField('Blue Shirt')).toBe('Blue Shirt')
    expect(escapeField(42)).toBe('42')
  })

  it('renders null and undefined as empty', () => {
    expect(escapeField(null)).toBe('')
    expect(escapeField(undefined)).toBe('')
  })

  it('quotes values containing a comma, quote, CR or LF', () => {
    expect(escapeField('Shirt, blue')).toBe('"Shirt, blue"')
    expect(escapeField('He said "hi"')).toBe('"He said ""hi"""')
    expect(escapeField('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeField('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  // A title like =cmd|'/c calc'!A1 executes on open in Excel. Merchant- and
  // customer-controlled text lands in a file other people open.
  it('defuses formula-injection prefixes', () => {
    expect(escapeField('=1+1')).toBe("'=1+1")
    expect(escapeField('+1')).toBe("'+1")
    expect(escapeField('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(escapeField('-1+1')).toBe("'-1+1")
  })

  // But a negative amount is data, not a formula. Prefixing it would turn
  // every refund into text in the spreadsheet.
  it('leaves negative numbers as numbers', () => {
    expect(escapeField('-3.50')).toBe('-3.50')
    expect(escapeField('-350')).toBe('-350')
  })

  it('quotes a formula-guarded value that also needs quoting', () => {
    expect(escapeField('=a,b')).toBe('"\'=a,b"')
  })

  // Several spreadsheet importers strip leading whitespace before deciding
  // whether a cell is a formula, so checking only s[0] is bypassable.
  it('defuses a formula hidden behind leading whitespace', () => {
    expect(escapeField(' =1+1')).toBe("' =1+1")
    expect(escapeField('\t=cmd|calc')).toBe("'\t=cmd|calc")
  })

  it('still leaves a whitespace-padded negative number alone', () => {
    expect(escapeField(' -3.50')).toBe(' -3.50')
  })
})

describe('toCsv', () => {
  it('emits a UTF-8 BOM, CRLF endings and a trailing newline', () => {
    const out = toCsv(['a', 'b'], [['1', '2']])
    expect(out).toBe('﻿a,b\r\n1,2\r\n')
  })

  it('emits headers only for no rows', () => {
    expect(toCsv(['a'], [])).toBe('﻿a\r\n')
  })

  // Arabic and Devanagari titles are the normal case in our markets.
  it('round-trips non-ASCII values', () => {
    const out = toCsv(['title'], [['خبز طازج'], ['ताज़ी ब्रेड']])
    expect(out).toContain('خبز طازج')
    expect(out).toContain('ताज़ी ब्रेड')
  })
})
