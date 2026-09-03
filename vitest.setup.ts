// Test environment bootstrap.
//
// DO NOT replace this with a bare `import 'dotenv/config'`. That loads ONLY
// `.env`, which in this repo points at the PRODUCTION Supabase database — so the
// integration suite would create and delete real rows in production (it did, for
// weeks: 23 leftover test tenants and 63 orphaned products had accumulated there
// before this was caught).
//
// Load `.env` first, then let `.env.local` OVERRIDE it — the same precedence
// `next dev` and `payload run` use — so `pnpm test:int` targets the LOCAL dev
// Postgres.
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

// FAIL FAST — this must abort the run before any test file gets a chance to
// connect and create/delete rows. `tests/int/db-target.int.spec.ts` asserts
// the same thing, but as "just another test" it only reports the problem
// AFTER other spec files (which may run first, alphabetically or otherwise)
// have already touched the database. On a fresh clone or in CI with no
// `.env.local`, the `config({ path: '.env' })` above alone points at the
// PRODUCTION Supabase database — exactly how 27 junk tenants and 63 orphaned
// products ended up in production. Throwing here, synchronously, at import
// time, is the only thing that stops that before it happens again.
const databaseUrl = process.env.DATABASE_URL ?? ''
if (!databaseUrl) {
  throw new Error(
    '[vitest.setup] DATABASE_URL is unset. The integration suite refuses to run without a ' +
      'confirmed LOCAL database — check that .env.local exists and defines DATABASE_URL.',
  )
}
// Redact credentials before this ever reaches a console or CI log — DATABASE_URL
// embeds the password, so the raw value must never be printed.
const redactedUrl = databaseUrl.replace(/\/\/[^@]*@/, '//***:***@')

if (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) {
  throw new Error(
    '[vitest.setup] DATABASE_URL does not point at localhost — refusing to run the integration ' +
      `suite against it: ${redactedUrl}. This suite must NEVER run against a remote database.`,
  )
}
if (databaseUrl.includes('supabase')) {
  throw new Error(
    '[vitest.setup] DATABASE_URL points at Supabase — refusing to run the integration suite ' +
      'against production. Check .env.local overrides DATABASE_URL to a local Postgres instance.',
  )
}
