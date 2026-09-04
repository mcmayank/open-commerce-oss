/**
 * Bridge between a human-typed major-unit price and the integer minor units the
 * app stores everywhere (see Products.ts, orders-math, payments/core/money).
 *
 * All conversion goes through payments/core/money — the single source of truth
 * for the ISO 4217 minor-unit exponent — so zero-decimal (JPY) and three-decimal
 * (KWD) currencies are handled correctly. Do NOT reintroduce `* 100` here.
 */
import { toMinor, fromMinor, currencyExponent } from '@/payments/core/money'

/**
 * Parse a user-entered major amount (e.g. "12.50", "1,234.5") into integer
 * minor units. Strips thousands separators and surrounding whitespace. Returns
 * null when the input is empty or not a valid non-negative number, so the caller
 * can leave the stored value untouched rather than writing NaN.
 */
export function parseMoneyInput(raw: string, currency: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const major = Number(cleaned)
  if (!Number.isFinite(major) || major < 0) return null
  return toMinor(major, currency)
}

/**
 * Render integer minor units as an editable major-unit string with the
 * currency's exponent as fixed decimals (no currency symbol — that's the
 * field's affordance). Empty string for an unset value.
 */
export function formatMinorForInput(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined) return ''
  return fromMinor(minor, currency).toFixed(currencyExponent(currency))
}
