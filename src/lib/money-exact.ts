/**
 * Exact conversion between integer minor units and a decimal string, in both
 * directions, without ever touching a float.
 *
 * The ISO 4217 exponent itself comes from `payments/core/money` — the one
 * canonical table — so zero-decimal (JPY) and three-decimal (KWD, BHD, OMR,
 * JOD) currencies are handled by construction rather than assumed away. This
 * module only knows how to shift digits.
 *
 * Why not `fromMinor` / `toMinor`: both go through a float. `minor / 10 ** exp`
 * is a float divide whose error `toFixed` happens to mask at realistic
 * magnitudes, and `Math.round(major * 10 ** exp)` multiplies a float that was
 * itself parsed from text. That is fine for filling an input box and not fine
 * for a financial record — and `CLAUDE.md` bans floats anywhere near a price.
 */
import { currencyExponent } from '@/payments/core/money'

/** Optional minus, whole digits, optionally one dot and more digits. Nothing else. */
const PLAIN_DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/

/**
 * Render integer minor units as an exact decimal string.
 * `formatMinorExact(1200, 'AED')` → `'12.00'`; `(1, 'OMR')` → `'0.001'`.
 */
export function formatMinorExact(minor: number, currency: string): string {
  if (!Number.isInteger(minor)) {
    throw new Error(`formatMinorExact expects integer minor units, received ${minor}`)
  }

  const exp = currencyExponent(currency)
  const negative = minor < 0
  // Pad so there is at least one digit before the decimal point.
  const digits = String(Math.abs(minor)).padStart(exp + 1, '0')
  const cut = digits.length - exp
  const whole = digits.slice(0, cut)
  const fraction = exp === 0 ? '' : `.${digits.slice(cut)}`

  return `${negative ? '-' : ''}${whole}${fraction}`
}

/**
 * Parse an exact decimal major-unit string into integer minor units.
 * `parseMinorExact('12.00', 'AED')` → `1200`; `('12.00', 'KWD')` → `12000`.
 *
 * The digits are shifted as text and parsed once as an integer. Nothing is ever
 * multiplied or divided by a power of ten, so `"8.87"` cannot arrive as 886.99.
 *
 * Deliberately strict about its input: sources emit machine-formatted decimals,
 * so a thousands separator or a currency symbol means we have misread the feed
 * and should stop rather than guess at what was meant.
 */
export function parseMinorExact(decimal: string, currency: string): number {
  const raw = typeof decimal === 'string' ? decimal.trim() : ''
  const match = PLAIN_DECIMAL.exec(raw)
  if (!match) {
    throw new Error(`Not a plain decimal amount: ${JSON.stringify(decimal)}`)
  }

  const [, sign, whole, fractionRaw = ''] = match
  const exp = currencyExponent(currency)
  let fraction = fractionRaw

  if (fraction.length > exp) {
    const excess = fraction.slice(exp)
    // Shopify emits two decimal places whatever the currency, so a JPY store
    // reports "1200.00". Trailing zeros carry no value and are dropped; a
    // non-zero digit past the currency's precision is a real amount we cannot
    // represent, and rounding it would invent a price nobody set.
    if (/[^0]/.test(excess)) {
      throw new Error(
        `"${raw}" has more decimal places than ${currency.toUpperCase()} allows ` +
          `(${exp}); refusing to round away real precision`,
      )
    }
    fraction = fraction.slice(0, exp)
  } else {
    fraction = fraction.padEnd(exp, '0')
  }

  const minor = Number(`${sign}${whole}${fraction}`)
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`"${raw}" in ${currency.toUpperCase()} is too large to hold exactly`)
  }

  // `Number('-000')` is -0, which compares equal to 0 but serialises as "-0".
  return minor === 0 ? 0 : minor
}
