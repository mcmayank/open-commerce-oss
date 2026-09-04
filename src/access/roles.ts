import type { Access } from 'payload'

export type TenantRole = 'tenant-admin' | 'tenant-staff'

/** Structural type: matches the shape of `users` docs (incl. multi-tenant plugin's tenants array). */
export type TenantsArrayUser = {
  roles?: ('super-admin')[] | null
  tenants?: { tenant: number | string | { id: number | string }; roles?: TenantRole[] | null }[] | null
}

export const isSuperAdmin = (user: TenantsArrayUser | null | undefined): boolean =>
  Boolean(user?.roles?.includes('super-admin'))

export const getUserTenantIDs = (
  user: TenantsArrayUser | null | undefined,
  role?: TenantRole,
): (string | number)[] => {
  if (!user?.tenants) return []
  return user.tenants.reduce<(string | number)[]>((ids, row) => {
    if (role && !row.roles?.includes(role)) return ids
    const t = row.tenant
    ids.push(typeof t === 'object' ? t.id : t)
    return ids
  }, [])
}

export const isSuperAdminAccess: Access = ({ req }) => isSuperAdmin(req.user as TenantsArrayUser | null)

/**
 * `admin.hidden` helper: hides a collection/global from the admin nav for
 * anyone who isn't a super-admin. Nav visibility only — pair with a `false`
 * `access.read` when the data must also be locked at the API.
 */
export const hiddenFromTenantNav = ({ user }: { user?: unknown }): boolean =>
  !isSuperAdmin(user as TenantsArrayUser | null)

export const extractTenantId = (value: unknown): string | number | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'object') return (value as { id?: string | number }).id
  return value as string | number
}

export const ownsTenant = (user: TenantsArrayUser, tenantId: string | number): boolean =>
  getUserTenantIDs(user).some((tid) => String(tid) === String(tenantId))
