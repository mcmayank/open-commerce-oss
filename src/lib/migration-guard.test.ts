import { afterEach, describe, expect, it, vi } from 'vitest'
import { migrationEnvironmentError, resolveDatabaseUrl, PRODUCTION_BUCKET } from './migration-guard'

describe('resolveDatabaseUrl', () => {
  // `resolveDatabaseUrl`'s parameter defaults to `process.env.DATABASE_URL`, and JS
  // default parameters also fire on an explicitly-passed `undefined`. So exercising
  // the "unset" path means controlling `process.env.DATABASE_URL` itself, not just
  // passing a literal `undefined` — otherwise the test silently depends on whatever
  // happens to be ambient in the shell/CI runner that runs the suite. `vi.stubEnv`
  // deletes/restores the real `process.env` entry (it proxies directly onto it), so
  // this stays hermetic regardless of what's exported outside vitest.
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the value when set', () => {
    expect(resolveDatabaseUrl('postgresql://user:pass@example.com:5432/db')).toBe(
      'postgresql://user:pass@example.com:5432/db',
    )
  })

  it('accepts a value with surrounding whitespace and returns it trimmed', () => {
    // Realistic case: a connection string pasted out of a .env file often carries a
    // trailing newline. The returned value must be the clean string handed to pg,
    // not the padded one.
    expect(resolveDatabaseUrl('  postgresql://user:pass@example.com:5432/db\n')).toBe(
      'postgresql://user:pass@example.com:5432/db',
    )
  })

  it('throws when unset (process.env.DATABASE_URL itself is absent, not just the argument)', () => {
    vi.stubEnv('DATABASE_URL', undefined)
    expect(() => resolveDatabaseUrl(undefined)).toThrow()
  })

  it('throws when empty', () => {
    expect(() => resolveDatabaseUrl('')).toThrow()
  })

  it('throws when whitespace-only', () => {
    expect(() => resolveDatabaseUrl('   ')).toThrow()
  })

  it('the thrown message names DATABASE_URL and the silent localhost fallback', () => {
    try {
      resolveDatabaseUrl('')
      throw new Error('expected resolveDatabaseUrl to throw')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toContain('DATABASE_URL')
      expect(message).toContain('127.0.0.1:5432')
    }
  })

  it('the thrown message mentions Vercel per-environment scoping (Preview vs Production)', () => {
    try {
      resolveDatabaseUrl('')
      throw new Error('expected resolveDatabaseUrl to throw')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toMatch(/preview/i)
      expect(message).toMatch(/production/i)
    }
  })
})

describe('migrationEnvironmentError', () => {
  it('refuses local database paired with the production bucket', () => {
    const message = migrationEnvironmentError({
      databaseUrl: 'postgresql://postgres@127.0.0.1:5432/postgres',
      bucket: PRODUCTION_BUCKET,
    })
    expect(message).toContain('Refusing to apply')
    expect(message).toContain(PRODUCTION_BUCKET)
  })

  it('also flags a localhost-hostname database against the production bucket', () => {
    const message = migrationEnvironmentError({
      databaseUrl: 'postgresql://postgres@localhost:5432/postgres',
      bucket: PRODUCTION_BUCKET,
    })
    expect(message).toContain('Refusing to apply')
  })

  it('returns null when the database and bucket both point at production', () => {
    const message = migrationEnvironmentError({
      databaseUrl: 'postgresql://user:pass@aws-0-region.pooler.supabase.com:6543/postgres',
      bucket: PRODUCTION_BUCKET,
    })
    expect(message).toBeNull()
  })

  it('returns null when the database is local and the bucket is not production', () => {
    const message = migrationEnvironmentError({
      databaseUrl: 'postgresql://postgres@127.0.0.1:5432/postgres',
      bucket: 'some-dev-bucket',
    })
    expect(message).toBeNull()
  })
})
