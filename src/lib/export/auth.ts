import { isSuperAdmin, getUserTenantIDs, type TenantsArrayUser } from '@/access/roles'

/**
 * May this user export this tenant's data?
 *
 * Tenant-admin of that exact tenant, or super-admin. Nothing else — an export
 * assembles every row of a store into one buffer, so this is the single
 * decision standing between a caller and another merchant's entire business.
 *
 * Note there is no plan check here and there must not be one: the export is
 * promised on every plan including Free.
 *
 * Called from two places that must never diverge: `src/app/api/export/route.ts`
 * (403s if this returns false) and `src/components/TenantDashboard.tsx` (hides
 * the "Export my data" card if this returns false). The dashboard's own
 * page-level guard, `ownsTenant`, admits tenant-staff too, so without this
 * second call here the card would render for a role the route then refuses.
 */
export function canExport(user: TenantsArrayUser | null, tenantId: string | number): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return getUserTenantIDs(user, 'tenant-admin').some((id) => String(id) === String(tenantId))
}
