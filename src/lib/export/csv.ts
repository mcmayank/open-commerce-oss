/**
 * RFC 4180 CSV serialisation for the merchant data export.
 *
 * Two non-obvious requirements, both about the file being opened by a human in
 * a spreadsheet rather than parsed by a machine:
 *
 *  - Formula injection. A product title beginning `=`, `+`, `-` or `@` is
 *    executed by Excel and Sheets on open. The text is merchant- and
 *    customer-controlled and the file gets forwarded to accountants, so a
 *    leading apostrophe forces it to be read as text.
 *  - Encoding. Excel mis-renders UTF-8 without a byte-order mark, and the
 *    primary markets are the UAE and India — Arabic and Devanagari titles are
 *    the normal case, not the edge case.
 */

const BOM = '﻿'
const CRLF = '\r\n'

const FORMULA_PREFIXES = ['=', '+', '-', '@']

/** A plain decimal number, optionally negative. Never formula-guarded. */
const NUMERIC = /^-?\d+(\.\d+)?$/

/** Characters that force a field to be quoted, per RFC 4180. */
const MUST_QUOTE = /[",\r\n]/

export function escapeField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)

  // Guard formulas, but never at the cost of turning a negative amount into
  // text — `-3.50` is data, `-1+1` is a formula. Detection looks past leading
  // whitespace — several spreadsheet importers strip it before deciding
  // whether a cell is a formula, so checking only `s[0]` is bypassable — but
  // the original value (including that whitespace) is preserved; only the
  // guard apostrophe goes in front.
  const trimmed = s.trimStart()
  if (trimmed.length > 0 && FORMULA_PREFIXES.includes(trimmed[0]) && !NUMERIC.test(trimmed)) {
    s = `'${s}`
  }

  if (MUST_QUOTE.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Serialise a header row and body rows into one CSV document. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeField).join(','),
    ...rows.map((row) => row.map(escapeField).join(',')),
  ]
  return BOM + lines.join(CRLF) + CRLF
}
