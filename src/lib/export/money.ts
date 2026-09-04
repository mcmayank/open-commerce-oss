/**
 * Money formatting for the data export.
 *
 * The implementation moved to `src/lib/money-exact.ts` when the product
 * importer needed the same digit-shifting in the opposite direction
 * (`parseMinorExact`). Keeping the pair together means one place decides how
 * minor units and decimal strings map onto each other; this module stays so
 * export callers keep their import path.
 */
export { formatMinorExact } from '@/lib/money-exact'
