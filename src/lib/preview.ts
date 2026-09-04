import { isSuperAdmin, ownsTenant, type TenantsArrayUser } from '@/access/roles'

/** Cookie that scopes an enabled draft-mode session to a single tenant, so a
 *  preview authorized for tenant A can't reveal tenant B's drafts. */
export const PREVIEW_TENANT_COOKIE = 'preview-tenant'

/** Cookie holding the storefront theme slug a tenant is trying on. Read only
 *  inside an authorized preview session (see resolvePreviewTheme). */
export const PREVIEW_THEME_COOKIE = 'preview-theme'

/** True if the user may preview drafts for `tenantId` (owner or super-admin). */
export function canPreview(
  user: TenantsArrayUser | null | undefined,
  tenantId: string | number,
): boolean {
  if (!user) return false
  return isSuperAdmin(user) || ownsTenant(user, tenantId)
}

/** Whether the storefront should serve the DRAFT version for this request:
 *  draft mode is on AND the preview-tenant cookie matches the resolved tenant. */
export function shouldServeDraft(input: {
  draftEnabled: boolean
  cookieTenantId: string | null | undefined
  hostTenantId: string | number
}): boolean {
  if (!input.draftEnabled) return false
  if (input.cookieTenantId == null) return false
  return String(input.cookieTenantId) === String(input.hostTenantId)
}

/** Resolve whether to serve the draft page, reading the preview cookie ONLY
 *  when draft mode is enabled. `readCookie` is injected so the caller can defer
 *  the cookies() lookup: reading cookies() is a dynamic API that opts the route
 *  out of the full route cache, so on the normal-visitor path (draft off) we
 *  must not invoke it — that is what keeps the storefront statically cacheable. */
export async function resolveDraftState(input: {
  draftEnabled: boolean
  hostTenantId: string | number
  readCookie: () => string | null | undefined | Promise<string | null | undefined>
}): Promise<boolean> {
  if (!input.draftEnabled) return false
  const cookieTenantId = await input.readCookie()
  return shouldServeDraft({
    draftEnabled: true,
    cookieTenantId,
    hostTenantId: input.hostTenantId,
  })
}

/** Resolve the storefront theme slug a tenant is previewing, or null for a
 *  normal visit. Mirrors resolveDraftState's cache-safety contract: when draft
 *  mode is off it returns null WITHOUT reading any cookie, so the storefront
 *  route stays statically cacheable. The theme override is honored only inside
 *  an authorized, tenant-matched preview session (same guard as draft pages),
 *  so a preview for tenant A can never restyle tenant B. A returned slug may be
 *  'default' — the tenant trying on the default storefront over a themed one. */
export async function resolvePreviewTheme(input: {
  draftEnabled: boolean
  hostTenantId: string | number
  readTenantCookie: () => string | null | undefined | Promise<string | null | undefined>
  readThemeCookie: () => string | null | undefined | Promise<string | null | undefined>
}): Promise<string | null> {
  if (!input.draftEnabled) return null
  const cookieTenantId = await input.readTenantCookie()
  const inSession = shouldServeDraft({
    draftEnabled: true,
    cookieTenantId,
    hostTenantId: input.hostTenantId,
  })
  if (!inSession) return null
  const theme = await input.readThemeCookie()
  return theme && theme.length > 0 ? theme : null
}
