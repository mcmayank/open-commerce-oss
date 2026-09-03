/**
 * Money — the canonical representation across the payment domain is
 * **integer minor units + ISO 4217 currency code**. Adapters convert at their
 * own boundary (some gateways want decimal strings, some want integers).
 *
 * The minor-unit exponent is NOT always 2. This module is the ONLY place that
 * knows how to convert between minor units and a major amount. Do not write
 * `amount / 100` anywhere else in the codebase.
 */

/**
 * Currencies with a ZERO-decimal minor unit (the minor unit IS the major unit).
 * e.g. ¥1000 is 1000 minor units, not 100000.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX',
  'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/**
 * Currencies with a THREE-decimal minor unit (1 major = 1000 minor).
 * e.g. KWD 1.000 is 1000 minor units.
 */
const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND',
])

/**
 * Return the ISO 4217 minor-unit exponent for a currency code.
 * Defaults to 2 (the common case) for anything not explicitly listed.
 */
export function currencyExponent(currency: string): number {
  const code = currency.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3
  return 2
}

/**
 * Convert integer minor units to a major-unit number.
 * `fromMinor(123450, 'INR')` → `1234.5`; `fromMinor(1000, 'JPY')` → `1000`.
 */
export function fromMinor(minor: number, currency: string): number {
  const exp = currencyExponent(currency)
  return minor / 10 ** exp
}

/**
 * Convert a major-unit amount to integer minor units, rounded to the nearest
 * minor unit. `toMinor(12.34, 'USD')` → `1234`; `toMinor(10, 'KWD')` → `10000`.
 */
export function toMinor(major: number, currency: string): number {
  const exp = currencyExponent(currency)
  return Math.round(major * 10 ** exp)
}

/**
 * Render integer minor units as a localized currency string.
 * `Intl.NumberFormat` applies the correct fraction-digit count per currency,
 * so JPY shows no decimals and KWD shows three — as long as we divide by the
 * right power of ten first (that's what `fromMinor` handles).
 */
export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(currency.toUpperCase() === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
  }).format(fromMinor(minor, currency))
}
