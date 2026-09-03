import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user.
  //
  // `roles: ['super-admin']` is load-bearing, not decoration. The admin is
  // host-bound: `gateDecision` (src/components/admin/HostBinding/gateDecision.ts)
  // renders the "No access to this store's admin" screen for any signed-in user
  // who is neither a super-admin nor a member of the tenant the current host
  // resolves to. E2E runs against a bare `localhost:3000`, which resolves to no
  // tenant, so a roles-less user logs in SUCCESSFULLY and then lands on that
  // screen — `login()` waits for /admin, never sees it, and the failure reads
  // like a credentials problem when it is an authorization one.
  //
  // This helper predates the role and host-binding model, which is why every
  // admin e2e spec had been failing.
  await payload.create({
    collection: 'users',
    data: { ...testUser, roles: ['super-admin'] },
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
