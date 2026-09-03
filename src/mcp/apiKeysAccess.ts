import type { CollectionConfig } from 'payload'
import { isSuperAdmin, type TenantsArrayUser } from '@/access/roles'

type UserId = string | number | undefined

/**
 * The plugin's `payload-mcp-api-keys` collection ships with NO access control, so it would
 * inherit Payload's default "any authenticated user can do anything". On a multi-tenant platform
 * that is privilege escalation: a member could mint a key whose `user` relationship points at a
 * super-admin (or another tenant's user) and act as them. These pure decisions lock every key to
 * its owner — super-admins excepted (support/ops).
 */

/** Read/update/delete constraint: super-admin → all; member → only rows where `user` is self. */
export function apiKeyOwnConstraint(
  user: TenantsArrayUser | null,
  userId: UserId,
): true | false | { user: { equals: string | number } } {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (userId === undefined) return false
  return { user: { equals: userId } }
}

/**
 * Force a member's key to point at themselves regardless of the submitted `user` (defends against a
 * spoofed relationship). Super-admins may assign any user; a missing user defaults to self.
 */
export function enforceSelfUser<T extends Record<string, unknown>>(
  user: TenantsArrayUser | null,
  userId: UserId,
  data: T,
): T {
  if (user && isSuperAdmin(user)) {
    return data.user === undefined ? { ...data, user: userId } : data
  }
  return { ...data, user: userId }
}

/**
 * Wrap the plugin-generated api-keys collection with owner-scoped access + a self-user guard.
 * Passed to `mcpPlugin({ overrideApiKeyCollection })`.
 */
export const hardenMcpApiKeys = (collection: CollectionConfig): CollectionConfig => {
  const constraint = ({ req }: { req: { user?: unknown } }) => {
    const user = req.user as (TenantsArrayUser & { id?: string | number }) | null
    return apiKeyOwnConstraint(user, user?.id)
  }
  return {
    ...collection,
    access: {
      ...collection.access,
      create: ({ req }) => Boolean(req.user),
      read: constraint,
      update: constraint,
      delete: constraint,
    },
    hooks: {
      ...collection.hooks,
      beforeValidate: [
        ...(collection.hooks?.beforeValidate ?? []),
        ({ req, data }) => {
          const user = req.user as (TenantsArrayUser & { id?: string | number }) | null
          return enforceSelfUser(user, user?.id, (data ?? {}) as Record<string, unknown>)
        },
      ],
    },
  }
}
