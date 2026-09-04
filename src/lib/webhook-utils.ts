/**
 * Returns true when the thrown error is a PostgreSQL unique-constraint violation
 * (error code 23505) or when the message otherwise signals a duplicate key.
 * Used to detect concurrent webhook delivery that already committed
 * (tenant, providerEventId) so we can return 200 instead of 500.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  // Postgres driver / pg-error-codes expose the code directly
  if ('code' in err && (err as Record<string, unknown>).code === '23505') return true
  // Fallback: check the error message for common duplicate-key phrases
  if ('message' in err && typeof (err as Record<string, unknown>).message === 'string') {
    const msg = ((err as Record<string, unknown>).message as string).toLowerCase()
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) return true
  }
  return false
}
