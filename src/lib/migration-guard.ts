/**
 * The one environment pairing that destroys data: reading rows from a LOCAL
 * database while deleting or rewriting objects in the PRODUCTION bucket.
 *
 * This was once the DEFAULT on a dev machine: `.env` pointed S3 at production
 * while `.env.local` pointed the database at localhost. Local development now
 * uses disk storage and sets no bucket at all, so the pairing should no longer
 * occur by accident — but the guard stays, because it costs nothing and the
 * failure it prevents is unrecoverable.
 *
 * Shared by every script that mutates bucket objects.
 */
export const PRODUCTION_BUCKET = 'niblrstore'

/**
 * `postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL || '' } })`
 * looks safe but is the second footgun this file exists for: `pg` treats an empty
 * connection string as "use my built-in default", which is `127.0.0.1:5432`. So an
 * unset DATABASE_URL doesn't fail with "DATABASE_URL is required" — it fails later,
 * during prerendering, with a misleading `connect ECONNREFUSED 127.0.0.1:5432`, as if
 * a real database refused the connection. That's what broke every Vercel Preview
 * deploy for weeks: Preview environments don't inherit Production's env vars (Vercel
 * scopes variables per environment), so the variable was simply never set there.
 *
 * Call this instead of reading `process.env.DATABASE_URL` directly anywhere a missing
 * value would otherwise be silently coerced into a local connection attempt.
 */
export function resolveDatabaseUrl(value: string | undefined = process.env.DATABASE_URL): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(
      'DATABASE_URL is not set. Payload\'s Postgres adapter turns a missing value into ' +
        'an empty connection string, and pg silently falls back to its own default of ' +
        '127.0.0.1:5432 — so this does not fail with "DATABASE_URL is required", it fails ' +
        'later with a misleading "connect ECONNREFUSED 127.0.0.1:5432", as if a real ' +
        'database refused the connection instead of never being configured. ' +
        'Set DATABASE_URL in your environment: locally, put it in .env.local (see the ' +
        'docblock at the top of src/lib/migration-guard.ts for the .env vs .env.local ' +
        'trap). On Vercel, environment variables are scoped per environment — a value ' +
        'present in Production is NOT automatically present in Preview or Development — ' +
        'so add DATABASE_URL explicitly under Project Settings > Environment Variables ' +
        'for every environment (Production, Preview, Development) that needs to build or ' +
        'run, and point Preview at its own database, not Production\'s.',
    )
  }
  return trimmed
}

export function migrationEnvironmentError(env: {
  databaseUrl: string
  bucket: string
}): string | null {
  const dbIsLocal = /localhost|127\.0\.0\.1/.test(env.databaseUrl)
  if (dbIsLocal && env.bucket === PRODUCTION_BUCKET) {
    return (
      `Refusing to apply: DATABASE_URL is local but S3_BUCKET is the production ` +
      `bucket ("${PRODUCTION_BUCKET}"). This reads local rows and deletes PRODUCTION ` +
      `objects. Point the database and the bucket at the same environment.`
    )
  }
  return null
}
