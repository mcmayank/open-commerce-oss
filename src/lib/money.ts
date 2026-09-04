/**
 * Money formatting for the storefront/admin UI.
 *
 * The canonical currency logic (the ISO 4217 minor-unit exponent table and all
 * minor↔major conversion) lives in `payments/core/money`. This module just
 * re-exports it so existing callers keep working while there is a single source
 * of truth — do NOT reintroduce `amount / 100` here.
 */
export { formatMoney, currencyExponent, fromMinor, toMinor } from '@/payments/core/money'
